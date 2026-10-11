# SKILLS/SKILL.md — دستورالعمل تخصصی پروژه

> **نسخه:** 0.7.0
> **تاریخ:** 2026-10-11
> **به‌روزرسانی شود:** با تغییر قراردادهای فنی، جریان توسعه یا API های داخلی

---


## قرارداد اجرایی جاری 0.7.0 (2026-10-11)

نسخه اجرایی Next.js/TypeScript + Django/DRF در یک برنامه shop است؛ SQLite توسعه و PostgreSQL تولید/هم‌زمانی. RAG، NeMo، LangGraph و Health AI در این نسخه اجرا نشده‌اند. بخش‌های طراحی AI در ادامه اهداف آینده‌اند؛ ساختارها و سرویس‌های مثال را به‌عنوان API نصب‌شده استفاده نکنید. مرجع رفتار واقعی کد، [PROJECT_CONTEXT](../PROJECT_CONTEXT.md) و [قرارداد API](../docs/api/CATALOG_API.md) است.

- کاتالوگ همه انواع و صفحه‌بندی دارد؛ facets از کل کالاهای عمومی، نه صفحه اول. دسته/برند جدید بدون تغییر UI.
- Product کالای مرجع و سیاست خرید؛ Vendor اعضا و هویت؛ Offer قیمت/موجودی مستقل. موجودی Product با Offer جمع نمی‌شود. approved عرضه فقط مرکزی؛ Seller نباید داده فروشنده دیگر ببیند.
- checkout سبد و موجودی را تراکنشی قفل می‌کند، snapshot فروشنده دارد؛ لغو/انقضا یک‌بار موجودی همان عرضه را برمی‌گرداند. زمان‌بند expire_orders جدا لازم است.
- cigarette/tobacco در سرور قابل خرید نیستند، حتی تأیید اشتباه؛ default SKU بررسی‌نشده است. پرداخت وجود ندارد.
- دود و فیلم سراسری حذف‌اند؛ هر موشن جدید باید محلی، بدون تاری محتوا و قابل توقف باشد. RTL، عرض ۳۲۰، موبایل/دسکتاپ، صفحه‌کلید و reduced-motion بررسی شوند.
- منبع وب باید مدل/بازار را اثبات کند؛ مشخصات/قیمت/موجودی نامعلوم حدس زده نشود. source_url و date و notes حفظ داده ویرایش‌شده دارند.
- روی feature branch توسعه و PR برای main باز شود؛ merge/deploy تولید در این مرحله انجام نمی‌شود. وضعیت نسخه و CHANGELOG/CONTEXT/DECISIONS/راهنمای عملیات به‌روز شوند.

## ۱. قراردادهای نام‌گذاری

### ۱.۱ Backend (Django)

```python
# Model
class CompatibilityRule(models.Model): ...       # PascalCase
class LegalClassification(models.Model): ...

# Field
legal_status = models.CharField(...)              # snake_case
ftnd_score = models.IntegerField(...)

# View
class ProductListView(generics.ListAPIView): ...  # PascalCase + suffix
class CatalogCompatibilityView(APIView): ...

# URL
/api/v1/catalog/products/                         # kebab-case, plural
/api/v1/catalog/compatibility/check/
/api/v1/health/session/

# Service
class CompatibilityService: ...
class LegalPolicyService: ...

# Serializer
class ProductSerializer(serializers.ModelSerializer): ...
```

### ۱.۲ Frontend (Next.js)

```typescript
// Component
export function CompatibilityFinder() {}          // PascalCase
export function ProductCard() {}

// Page (App Router)
app/shop/[category]/page.tsx
app/compatibility/page.tsx
app/health/page.tsx

// Hook
function useCompatibility(deviceId: string) {}    // camelCase + use prefix
function useHealthSession() {}

// Type/Interface
interface CompatibilityResult {}                  // PascalCase
type LegalStatus = 'APPROVED_ONLINE' | 'CATALOG_ONLY' | ...

// API call
const data = await fetchCompatibleParts(deviceId);  // camelCase
```

### ۱.۳ Database

```sql
-- Table: snake_case, plural
catalog_products
catalog_compatibility_rules
legal_classifications
inventory_stock_ledger
health_sessions

-- Column: snake_case
legal_status VARCHAR(30) NOT NULL DEFAULT 'REVIEW_REQUIRED'
ftnd_partial_score JSONB
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

---

## ۲. قراردادهای Legal Status

```python
class LegalStatus(models.TextChoices):
    APPROVED_ONLINE = 'APPROVED_ONLINE', 'مجاز برای فروش آنلاین'
    CATALOG_ONLY    = 'CATALOG_ONLY',    'فقط کاتالوگ'
    IN_PERSON_ONLY  = 'IN_PERSON_ONLY',  'فقط حضوری'
    REVIEW_REQUIRED = 'REVIEW_REQUIRED', 'نیاز به بررسی'
    BLOCKED         = 'BLOCKED',         'مسدود'
```

**قانون:** هر SKU جدید باید `REVIEW_REQUIRED` باشد تا ناظر حقوقی تغییر دهد.
**قانون:** Cart API هر SKU غیر `APPROVED_ONLINE` را با `HTTP 403` رد می‌کند.

---

## ۳. قراردادهای Compatibility Engine

### ۳.۱ ساختار گراف

```python
# گراف DAG از قطعات
# هر یال: (parent_device, compatible_part, confidence, evidence_source)

class CompatibilityRule(models.Model):
    parent_device = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='parent_rules')
    compatible_part = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='compatible_rules')
    confidence_level = models.CharField(choices=[
        ('CONFIRMED', 'تأیید‌شده'),
        ('PROBABLE', 'محتمل'),
        ('EXPERIMENTAL', 'آزمایشی'),
    ])
    evidence_source = models.TextField()  # منبع سازگاری
    last_verified = models.DateField()
    is_incompatible = models.BooleanField(default=False)  # نمایش ناسازگاری
```

### ۳.۲ تابع رتبه‌بندی

```python
# وزن رتبه‌بندی نهایی:
# 1. تطابق مکانیکی: وزن بازدارنده مطلق (اگر 0 شد → از لیست حذف)
# 2. امتیاز تشابه حسی: فقط اگر تطابق مکانیکی 100% باشد
# 3. موجودی انبار: ضریب رتبه‌بندی

final_score = (
    mechanical_match * ABSOLUTE_WEIGHT +          # اگر 0 → exclude
    sensory_similarity * SENSORY_WEIGHT +          # فقط اگر mechanical == 100%
    inventory_factor * INVENTORY_WEIGHT
)
```

---

## ۴. قراردادهای RAG Pipeline

### ۴.۱ Chunking

```python
# کاتالوگ
def chunk_catalog_doc(doc: str) -> list[Chunk]:
    """
    استراتژی: بر مبنای موجودیت SKU
    اندازه: 300 توکن
    هم‌پوشانی: ندارد (موجودیت‌ها مجزا هستند)
    فیلدهای BM25: sku, brand, ohm, diameter, material
    """

# سلامت
def chunk_health_doc(doc: str) -> list[Chunk]:
    """
    استراتژی: پاراگرافی با سناریوهای OARS
    اندازه: 500 توکن
    هم‌پوشانی: 15%
    فیلدهای BM25: behavioral_terms, craving_triggers, stage_of_change
    """
```

### ۴.۲ آستانه‌های تشابه

```python
CATALOG_SIMILARITY_THRESHOLD = 0.82  # سخت: جلوگیری از عدم تطابق مکانیکی
HEALTH_SIMILARITY_THRESHOLD  = 0.75  # نرم‌تر: تنوع بیانی مراجعان
```

### ۴.۳ پرامپت الزامی

```python
CATALOG_SYSTEM_PROMPT = """
فقط از اطلاعات موجود در بلوک دانش زیر استنتاج کن.
اگر اطلاعات کافی وجود ندارد، بگو «اطلاعات کافی ندارم» و کاربر را به کارشناسان ارجاع بده.
هرگز مشخصات فنی را حدس نزن.
"""

HEALTH_SYSTEM_PROMPT = """
تو یک دستیار پشتیبانی ترک دخانیات هستی، نه پزشک.
از پروتکل‌های 5As و OARS پیروی کن.
هرگز دوز دارو توصیه نکن.
اگر FTND > 6 یا بحران روانی: ارجاع به ۴۰۳۰ داخلی ۵ الزامی است.
"""
```

---

## ۵. API Conventions

### ۵.۱ ساختار Response

```json
// موفق
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}

// خطا
{
  "success": false,
  "error": {
    "code": "LEGAL_STATUS_BLOCKED",
    "message": "این کالا برای خرید آنلاین مجاز نیست.",
    "detail": "..."
  }
}
```

### ۵.۲ کدهای خطای Legal

```
LEGAL_STATUS_CATALOG_ONLY  → 403
LEGAL_STATUS_IN_PERSON     → 403
LEGAL_STATUS_REVIEW        → 403
LEGAL_STATUS_BLOCKED       → 403
UNDERAGE_DETECTED          → 403
```

### ۵.۳ Versioning

```
/api/v1/...    ← نسخه فعال
/api/v2/...    ← نسخه بعدی (در صورت تغییر breaking)
```

---

## ۶. Audit Log — قرارداد ثبت

```python
# هر تغییر حساس باید Audit Log داشته باشد:
AuditLog.objects.create(
    user=request.user,
    action="SKU_LEGAL_STATUS_CHANGE",  # UPPER_SNAKE_CASE
    entity_type="Product",
    entity_id=product.id,
    before={"legal_status": "REVIEW_REQUIRED"},
    after={"legal_status": "APPROVED_ONLINE"},
    ip_address=get_client_ip(request),
    user_agent=request.META.get('HTTP_USER_AGENT'),
)
```

**رویدادهایی که باید ثبت شوند:**
- تغییر `legal_status` هر SKU
- تغییر قیمت
- تغییر موجودی (بیش از 10 واحد)
- تغییر وضعیت سفارش
- ورود/خروج ادمین
- تغییر نقش کاربر
- فعال/غیرفعال Feature Flag

---

## ۷. Feature Flag — قرارداد

```python
# تعریف Flag
class FeatureFlag(models.Model):
    key = models.CharField(unique=True)  # مثال: 'cart_hookah_accessories'
    is_enabled = models.BooleanField(default=False)
    description = models.TextField()
    legal_document = models.FileField(null=True)  # سند حقوقی تأیید
    enabled_by = models.ForeignKey(User, null=True)
    enabled_at = models.DateTimeField(null=True)

# استفاده در کد
if FeatureFlag.is_active('cart_hookah_accessories'):
    allow_cart_action()
else:
    raise PermissionDenied("این دسته هنوز برای فروش آنلاین تأیید نشده.")
```

---

## ۸. UX Components — قراردادها

### ۸.۱ کارت محصول در حالت Catalog Only

```tsx
// اگر legal_status != 'APPROVED_ONLINE':
// دکمه خرید جایگزین می‌شود با:
<Button disabled variant="catalog">
  مشاهده مشخصات و موجودی در شعب حضوری
</Button>
// هرگز قیمت تشویقی، شمارش معکوس یا «موجودی محدود» نمایش داده نشود
```

### ۸.۲ سوئیچ وضعیت AI Widget

```tsx
// حالت کاتالوگ: border-charcoal + copper accent
// حالت سلامت: background-ivory + neutral tones
// تغییر باید با Transition 300ms انجام شود
// در حالت سلامت: تمام ارجاعات تجاری از Context حذف شوند
```

### ۸.۳ اسلایدر فاگرشتروم

```tsx
// در حالت سلامت AI:
// پرسش‌های FTND به صورت اسلایدر نمایش داده می‌شوند
// نمره نمایش داده نمی‌شود تا کاربر احساس آزمون نداشته باشد
// پاسخ‌ها در HealthAgentState.ftnd_partial ذخیره می‌شوند
```

---

## ۹. جریان توسعه (Development Flow)

```
1. بررسی PROJECT_CONTEXT.md (موارد باز)
2. بررسی PROJECT_DECISIONS.md (محدودیت‌ها)
3. ایجاد Branch: feature/<ticket>-<description>
4. توسعه محلی + تست واحد
5. بررسی Legal Policy برای هر تغییر مرتبط با Cart/Payment
6. Pull Request با Checklist:
   - [ ] تست نوشته شده
   - [ ] Audit Log اضافه شده (اگر نیاز)
   - [ ] Feature Flag بررسی شده
   - [ ] مستندات به‌روز شده
7. Code Review
8. Merge → Deploy Staging → تأیید → Deploy Production
```

---

## ۱۰. موارد ممنوع (Never Do)

```
✗ افزودن SKU غیر APPROVED_ONLINE به Cart از هر مسیر
✗ تزریق منطق تجاری به Health Agent
✗ تزریق پروتکل بالینی به Catalog Agent
✗ Cross-sell از بستر ترک به محصول
✗ توصیه دوز دارو یا NRT در Health Agent
✗ استفاده از صفات هیجانی در توصیف محصولات دخانی
✗ ادعای «بی‌ضرر» یا «کم‌ضرر» بدون استناد علمی تأیید‌شده
✗ درگاه پرداخت برای کالای بدون تأیید رسمی شاپرک
✗ حذف Audit Log از تغییرات حساس
✗ Restart سرویس‌های نامرتبط در Production
```
