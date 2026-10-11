# AI/EXECUTION_GUIDE.md — راهنمای اجرای AI

> **نسخه:** 0.8.0
> **تاریخ:** 2026-10-11
> **به‌روزرسانی شود:** با تغییر فرایند اجرا، دامنه عامل‌ها یا دستور اجرا

---


## قرارداد اجرایی جاری 0.8.0 (2026-10-11)

نسخه اجرایی Next.js/TypeScript + Django/DRF در یک برنامه shop است؛ SQLite توسعه و PostgreSQL تولید/هم‌زمانی. RAG، NeMo، LangGraph و Health AI در این نسخه اجرا نشده‌اند. بخش‌های طراحی AI در ادامه اهداف آینده‌اند؛ ساختارها و سرویس‌های مثال را به‌عنوان API نصب‌شده استفاده نکنید. مرجع رفتار واقعی کد، [PROJECT_CONTEXT](../PROJECT_CONTEXT.md) و [قرارداد API](../docs/api/CATALOG_API.md) است.

- کاتالوگ مستقل /catalog همه انواع و صفحه‌بندی دارد؛ هوم‌پیج فقط سیگار است و اکسسوری در /catalog?type=accessory می‌ماند؛ facets از کل کالاهای عمومی، نه صفحه اول. دسته/برند جدید بدون تغییر UI.
- Product کالای مرجع و سیاست خرید؛ Vendor اعضا و هویت؛ Offer قیمت/موجودی مستقل. موجودی Product با Offer جمع نمی‌شود. approved عرضه فقط مرکزی؛ Seller نباید داده فروشنده دیگر ببیند.
- checkout سبد و موجودی را تراکنشی قفل می‌کند، snapshot فروشنده دارد؛ لغو/انقضا یک‌بار موجودی همان عرضه را برمی‌گرداند. زمان‌بند expire_orders جدا لازم است.
- cigarette/tobacco در سرور قابل خرید نیستند، حتی تأیید اشتباه؛ default SKU بررسی‌نشده است. پرداخت وجود ندارد.
- فیلم دود فقط در hero پخش می‌شود؛ در خروج از دید/تب مخفی توقف دارد و reduced-motion رسانه را بارگذاری نمی‌کند. هر موشن جدید محلی، بدون تاری محتوا و قابل توقف باشد. RTL، عرض ۳۲۰، موبایل/دسکتاپ، صفحه‌کلید و reduced-motion بررسی شوند.
- منبع وب باید مدل/بازار را اثبات کند؛ مشخصات/قیمت/موجودی نامعلوم حدس زده نشود. source_url و date و notes حفظ داده ویرایش‌شده دارند.
- روی feature branch توسعه و PR برای main باز شود؛ merge/deploy تولید در این مرحله انجام نمی‌شود. وضعیت نسخه و CHANGELOG/CONTEXT/DECISIONS/راهنمای عملیات به‌روز شوند.
- استثنای صریح مالک برای این جلسه: PR #1 با CI موفق در main ادغام شد (88f532a)؛ ادامه در feature/premium-storefront. نسخهٔ جدید فقط برای تست است؛ مجوز deploy تولید ندارد. q/category/brand لینک مستقیم، دروازه۱۸+ و حالت خالی چهار ورودی دسته با E2E بررسی شوند. گزارش pull ویندوز و نتایج در docs/deployment/PREMIUM_STOREFRONT.md است.

## ۱. ترتیب مطالعه برای هر جلسه کاری

قبل از شروع هر کار روی این پروژه، این فایل‌ها را **به ترتیب** مطالعه کن:

```
1. AGENTS.md               ← قواعد بنیادی و خطوط قرمز
2. PROJECT_CONTEXT.md      ← وضعیت جاری و موارد باز
3. PROJECT_DECISIONS.md    ← تصمیمات تأییدشده
4. SKILLS/SKILL.md         ← قراردادهای فنی جاری
5. این فایل (EXECUTION_GUIDE.md)
```

اگر روی یک ماژول خاص کار می‌کنی، فایل مستند آن ماژول را هم بخوان.

---

## ۲. قوانین اجرای AI

### ۲.۱ قبل از هر تغییر کد

```
Review → Analyze Dependencies → Risk → Minimal Patch → Local Test → Transfer
```

1. **فایل فعلی بخوان** — هرگز بدون خواندن تغییر نده.
2. **Dependency بررسی کن** — Import، Caller، Callee، Public API.
3. **Runtime Evidence اول** — API، SQL، Log و Config حدس زده نمی‌شوند.
4. **Minimal Patch** — کوچک‌ترین تغییر ممکن؛ نامرتبط‌ها جدا.

### ۲.۲ حفظ رفتار موجود

بدون ضرورت فنی یا درخواست صریح، این‌ها **تغییر نمی‌کنند**:
- نام کلاس، تابع، Parameter
- SQL Query و Transaction Semantics
- Log Messages
- Public API و Import Paths
- Docstring و Comment

### ۲.۳ محیط Production

- Production محل آزمایش نیست.
- قبل از هر عملیات سرور: Path، Service، Container، DB، Port بررسی شود.
- `pm2 restart all` / `docker system prune` / `killall` — **هرگز** بدون بررسی scope.

---

## ۳. معماری عامل‌ها

### ۳.۱ نقشه کلی

```
                    ┌─────────────────────────────┐
                    │        User Input            │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Input Guardrail (NeMo)     │
                    │  - Age Detection             │
                    │  - Prompt Injection Filter   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     Supervisor Router        │
                    │  (Intent Classification)     │
                    └──┬─────────────────┬────────┘
                       │                 │
          ┌────────────▼──┐      ┌───────▼────────────┐
          │  Catalog Agent │      │   Health Agent      │
          │  (Shop/Tech)   │      │   (Quit Support)    │
          └────────┬───────┘      └────────┬────────────┘
                   │                       │
          ┌────────▼───────┐      ┌────────▼────────────┐
          │ Catalog RAG KB  │      │   Health RAG KB      │
          │ BM25+Dense+RRF  │      │   BM25+Dense+RRF     │
          │ Threshold: 0.82 │      │   Threshold: 0.75    │
          └────────┬───────┘      └────────┬────────────┘
                   │                       │
          ┌────────▼───────────────────────▼────────────┐
          │         Output Guardrail (NeMo)              │
          │  - Anti-promotion filter                     │
          │  - Medical claim filter                      │
          │  - Crisis detection → Emergency contacts     │
          └────────────────────┬────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    UI (Next.js)      │
                    └─────────────────────┘
```

### ۳.۲ قوانین مسیریابی

| نیت کاربر | عامل | یادداشت |
|---|---|---|
| سؤال فنی (سازگاری، مشخصات) | `CatalogAgent` | — |
| ترک مصرف، وابستگی، نگرانی سلامت | `HealthAgent` | Context تجاری پاک می‌شود |
| خارج از حوزه | `OutOfScope` | رد محترمانه + هدایت |

### ۳.۳ انتقال حالت

```python
# کاتالوگ → سلامت: خودکار
if intent == "quit_tobacco" or "health_concern":
    clear_commercial_context()
    switch_to(HealthAgent)

# سلامت → کاتالوگ: فقط با دکمه صریح
if explicit_exit_button_pressed:
    review_quit_reasons()
    switch_to(CatalogAgent)
```

---

## ۴. خط لوله RAG

### ۴.۱ پیکربندی کاتالوگ

```yaml
embedding_model: multilingual-industrial-dense
embedding_dims: 1536
chunking_strategy: SKU-entity-based
chunk_size: 300 tokens
bm25_fields: [sku_version, brand, ohm, diameter, material]
similarity_threshold: 0.82
reranker: cross-encoder-compatibility-check
```

### ۴.۲ پیکربندی سلامت

```yaml
embedding_model: clinical-optimized
embedding_dims: 3072
chunking_strategy: paragraph-OARS-scenario
chunk_size: 500 tokens
overlap: 15%
bm25_fields: [craving_triggers, behavioral_terms, stage_of_change]
similarity_threshold: 0.75
reranker: cross-encoder-health-guideline
```

### ۴.۳ فرمول RRF

```
RRF_Score(d) = Σ_{m ∈ {dense, bm25}} 1 / (k + r_m(d))
k = 60  (ثابت هموارسازی استاندارد)
```

---

## ۵. گاردریل‌ها — دستور اجرا

### ۵.۱ ورودی (Input)

```
1. Age Detection → اگر الگوی زیر ۱۸ سال → قطع + ثبت بلک‌لیست
2. Prompt Injection → اگر Jailbreak شناسایی شد → لغو + پاکسازی تاریخچه
3. Topic Classification → تأیید نیت قابل پردازش
```

### ۵.۲ موضعی (Topical)

```
- خارج از حوزه → رد محترمانه
- سیاست/ادیان → هدایت به محدوده
```

### ۵.۳ خروجی (Output)

```
1. Anti-promotion scan → عبارت هیجانی/ادعای بی‌ضرر → بازنویسی خنثی
2. Medical claim scan → توصیه دارویی → حذف + جایگزینی با ارجاع
3. Crisis detection → خودآسیبی/اضطراب → توقف + نمایش اورژانس
```

### ۵.۴ اورژانس‌های ثابت

```
سامانه ترک دخانیات وزارت بهداشت: ۴۰۳۰ داخلی ۵ (رایگان)
اورژانس اجتماعی: ۱۲۳
```

---

## ۶. وضعیت حالت در Health Agent

```python
class HealthAgentState:
    ftnd_score: int           # 0-10 (Fagerström)
    ftnd_partial: dict        # پاسخ‌های جمع‌آوری‌شده تا الان
    stage_of_change: str      # precontemplation|contemplation|action
    quit_date: date | None    # تاریخ هدف (STAR protocol)
    triggers: list[str]       # محرک‌های شناسایی‌شده
    session_count: int        # تعداد جلسات
    last_session: datetime    # آخرین تعامل
    referral_sent: bool       # آیا ارجاع ۴۰۳۰ داده شده
```

اگر `ftnd_score >= 6`: پیشنهاد مراجعه کلینیک + ارجاع ۴۰۳۰ الزامی.

---

## ۷. نسبت بازتاب به پرسش (OARS Target)

```
نسبت بهینه: 1 ≤ Reflection/Question ≤ 2
```

اگر نسبت کمتر از ۱ شود: تعارض درونی کاربر افزایش می‌یابد.
اگر نسبت بیشتر از ۲ شود: مکالمه یک‌طرفه به نظر می‌رسد.

---

## ۸. پروتکل STAR در برنامه‌ریزی ترک

```
S = Set a Quit Date     → تاریخ قطعی در بازه کوتاه
T = Tell Others         → اطلاع به اطرافیان برای تعهد اجتماعی
A = Anticipate Triggers → شناسایی محرک‌ها و جایگزین‌ها
R = Remove Tobacco      → حذف ابزارهای دخانی از محیط
```

---

## ۹. اعتبارسنجی پیش از Deploy

```bash
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
backend/.venv/bin/python backend/manage.py test shop
cd frontend
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

**قانون:** Compile موفق به معنی Regression PASS نیست. تست رگرسیون الزامی است.

---

## ۱۰. ساختار پوشه پروژه (هدف)

```
smokeshop/
├── AGENTS.md
├── README.md
├── PROJECT_CONTEXT.md
├── PROJECT_DECISIONS.md
├── CHANGELOG.md
├── VERSION
├── AI/
│   └── EXECUTION_GUIDE.md
├── SKILLS/
│   └── SKILL.md
├── docs/
│   ├── README.md
│   └── MAINTENANCE.md
├── backend/               ← Django + DRF
│   ├── config/
│   ├── catalog/
│   ├── compatibility/
│   ├── legal/
│   ├── inventory/
│   ├── orders/
│   ├── customers/
│   ├── health_ai/
│   ├── rag/
│   └── audit/
├── frontend/              ← Next.js + TypeScript
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
├── ai/                    ← LangGraph Agents
│   ├── agents/
│   ├── guardrails/
│   └── rag/
├── infra/                 ← Docker, Nginx, CI/CD
└── tests/
```
