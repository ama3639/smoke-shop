# docs/README.md — فهرست و نقشه مستندات

> **نسخه:** 0.11.0
> **تاریخ:** 2026-10-26
> **به‌روزرسانی شود:** با افزودن یا حذف هر سند

---

## نقشه کلی مستندات

```
smokeshop/
├── AGENTS.md              ← قواعد عامل/همکار
├── README.md              ← معرفی، نصب و اجرا
├── PROJECT_CONTEXT.md     ← وضعیت جاری، دامنه، موارد باز
├── PROJECT_DECISIONS.md   ← تصمیمات تأییدشده (ADR)
├── CHANGELOG.md           ← تاریخچه تغییرات نسخه‌ها
├── VERSION                ← نسخه جاری (SemVer)
├── AI/
│   └── EXECUTION_GUIDE.md ← راهنمای اجرای AI
├── SKILLS/
│   └── SKILL.md           ← دستورالعمل تخصصی توسعه
└── docs/
    ├── README.md          ← این فایل — فهرست مستندات
    └── MAINTENANCE.md     ← سیاست نگهداری و کنترل انتشار
```

---

## فهرست مستندات

### مستندات پایه پروژه

| سند | مسیر | هدف | به‌روزرسانی |
|---|---|---|---|
| AGENTS.md | [/AGENTS.md](../AGENTS.md) | قواعد کلی عامل و همکار | با تغییر سیاست کاری |
| README.md | [/README.md](../README.md) | معرفی، نصب، اجرا | هر نسخه |
| PROJECT_CONTEXT | [/PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) | وضعیت جاری و موارد باز | هر نسخه |
| PROJECT_DECISIONS | [/PROJECT_DECISIONS.md](../PROJECT_DECISIONS.md) | تصمیمات تأییدشده | با تصمیم جدید |
| CHANGELOG | [/CHANGELOG.md](../CHANGELOG.md) | تاریخچه تغییرات | هر نسخه |
| VERSION | [/VERSION](../VERSION) | نسخه جاری | هر نسخه |

### مستندات AI

| سند | مسیر | هدف | به‌روزرسانی |
|---|---|---|---|
| EXECUTION_GUIDE | [/AI/EXECUTION_GUIDE.md](../AI/EXECUTION_GUIDE.md) | ترتیب مطالعه و قواعد اجرا | با تغییر فرایند یا دامنه |

### مستندات توسعه

| سند | مسیر | هدف | به‌روزرسانی |
|---|---|---|---|
| SKILL.md | [/SKILLS/SKILL.md](../SKILLS/SKILL.md) | قراردادهای فنی تخصصی | با تغییر قراردادها |

### مستندات عملیات

| سند | مسیر | هدف | به‌روزرسانی |
|---|---|---|---|
| MAINTENANCE | [/docs/MAINTENANCE.md](MAINTENANCE.md) | سیاست نگهداری و انتشار | هر نسخه |

### اسناد منبع معماری

| سند | مسیر | توضیح |
|---|---|---|
| Comprehensive Architecture | [/Comprehensive Architecture.txt](../Comprehensive%20Architecture.txt) | معماری جامع هوش مصنوعی |
| Online Store Spec | [/Online Store for Tobacco and Accessories.md](../Online%20Store%20for%20Tobacco%20and%20Accessories.md) | طرح جامع فروشگاه |

---

## راهنمای اجرایی موجود

- [LOCAL_SETUP](deployment/LOCAL_SETUP.md) — نصب Windows/Linux، مدیریت کالا، تست، backup و محدودیت‌های تولید.

## مستندات برنامه‌ریزی‌شده (آینده)

این مستندات در فازهای بعدی اضافه می‌شوند:

### معماری فنی (فاز یک)
- `docs/architecture/SYSTEM_OVERVIEW.md` — نمودار کلان سیستم
- `docs/architecture/CATALOG_MODULE.md` — مستندات ماژول کاتالوگ
- `docs/architecture/COMPATIBILITY_ENGINE.md` — مستندات موتور سازگاری
- `docs/architecture/LEGAL_POLICY.md` — مستندات Legal Policy Engine
- `docs/architecture/RAG_PIPELINE.md` — مستندات خط لوله RAG
- `docs/architecture/HEALTH_AGENT.md` — مستندات عامل سلامت
- `docs/architecture/GUARDRAILS.md` — مستندات گاردریل‌ها

### API (فاز یک)
- `docs/api/CART_API.md` — مستندات API سبد خرید
- `docs/api/HEALTH_API.md` — مستندات API عامل سلامت
- `docs/api/ADMIN_API.md` — مستندات API پنل مدیریتی

### راهنماهای استقرار (فاز یک)
- `docs/deployment/STAGING.md` — محیط Staging
- `docs/deployment/PRODUCTION.md` — راهنمای Production
- `docs/deployment/BACKUP_RECOVERY.md` — پشتیبان‌گیری و بازیابی

### راهنماهای کاربری آینده
- `docs/user/LEGAL_COMPLIANCE.md` — راهنمای انطباق حقوقی
- `docs/user/SKU_CLASSIFICATION.md` — راهنمای طبقه‌بندی SKU

---

## قوانین مستندسازی

1. **هر مستند جدید** باید در این فهرست اضافه شود.
2. **هر مستند حذف‌شده** باید از فهرست خارج و دلیل آن در CHANGELOG ثبت شود.
3. **زبان:** فارسی برای توضیحات، انگلیسی برای کد، نام فایل و اصطلاحات فنی.
4. **فرمت:** Markdown با heading‌های واضح و جداول ساختاریافته.
5. **تاریخ:** هر مستند باید تاریخ آخرین به‌روزرسانی داشته باشد.
6. **نسخه:** هر مستند مرتبط با نسخه باید نسخه را در header داشته باشد.

## کاتالوگ تصویری جاری

[نگاشت ۱۴ تصویر وینستون و روش نگهداری](catalog/PRODUCT_IMAGES.md) شامل نام مدل‌ها، فایل‌های اصلی/سبک، اتصال به داده و روش به‌روزرسانی است.


## مستندات اجرایی 0.10.0

- [ADMIN_GUIDE](user/ADMIN_GUIDE.md) — نقش‌ها، اعضای فروشنده، عرضه مستقل، لغو و انقضا.
- [PREMIUM_STOREFRONT](deployment/PREMIUM_STOREFRONT.md) — نسخه۰.۸، گزارش refactor/تست و دریافت ویندوز از برنچ جدید.
- [CATALOG_API](api/CATALOG_API.md) — facets، صفحه‌بندی، انتخاب عرضه و قرارداد سازگار سبد.
- [PRODUCT_DATA](catalog/PRODUCT_DATA.md) — منابع بررسی‌شده و مشخصات تکمیل‌نشده.
- [HOMEPAGE_IMAGE](catalog/HOMEPAGE_IMAGE.md) — عکس کامل موبایل/دسکتاپ و تعویض دارایی.

بخش‌های «برنامه‌ریزی‌شده» و اسناد معماری جامع، اجراشده تلقی نمی‌شوند. وضعیت کد در PROJECT_CONTEXT ثبت است.

نسخه 0.10.0 رابط: Titanium Silver، شش دسته، شش سیگار منتخب، دود محلی، حساب/علاقه‌مندی و جست‌وجوی سراسری؛ کاتالوگ مستقل همه کالاها در /catalog. آدرس ادمین توسعه: http://localhost:8000/admin/.



## مسیرهای جاری Titanium Silver

- [Security Notes](SECURITY_NOTES.md): Advisory توسعه بدون patch، Audit تولید و برنامه رفع سازگار؛ نتیجه تست کامل لوکال مستقل از CI است.

- [Design System](design/DESIGN_SYSTEM.md): مرجع ماکاپ، tokens، کامپوننت، RTL، motion و تصاویر.
- [گزارش و Acceptance / Windows](deployment/PREMIUM_STOREFRONT.md): دستور مستقل، validation و چک‌لیست مالک.
- متن‌های نسخه‌های قبل درباره پالت روشن/برنچ premium-storefront تاریخی‌اند؛ قرارداد جاری DEC-029 است.

