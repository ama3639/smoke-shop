# CHANGELOG

تمام تغییرات قابل‌توجه این پروژه در این فایل مستند می‌شوند.

فرمت مبتنی بر [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) است.  
نسخه‌بندی مطابق [Semantic Versioning](https://semver.org/spec/v2.0.0.html) انجام می‌شود.

---

## [0.2.0] — 2026-10-09

### Added

- زیرساخت فروشگاه: Next.js، Django، کاتالوگ و جست‌وجوی فارسی، سازگاری، شعب و تصویر کالا.
- رابط RTL و فونت وزیرمتن محلی با پالت عاجی/زغالی/مسی.
- سبد مهمان، درخواست سفارش بدون پرداخت، رزرو و لغو تراکنشی موجودی.
- کنترل حقوقی API، نقش‌های مدیریت، دفتر موجودی و Audit Log.
- نصب و اجرای چندسکویی، تست API/مرورگر و CI PostgreSQL.

### Scope

- داده‌ها نمونه‌اند؛ فروش و سفارش پیش‌فرض خاموش‌اند. درگاه، AI و موشن اسکرول سه‌بعدی متصل نیستند.

## [Unreleased]

### در دست توسعه

- موشن اسکرول سه‌بعدی بر اساس درخواست‌های بعدی
- اتصال پرداخت و تکمیل فرآیند عملیاتی پس از تأییدهای لازم

---

## [0.1.0] — 2026-10-08

### Added

- مستندات پایه پروژه:
  - `AGENTS.md` — قواعد کلی عامل و همکار
  - `README.md` — معرفی، نصب و اجرا
  - `PROJECT_CONTEXT.md` — وضعیت و دامنه جاری
  - `PROJECT_DECISIONS.md` — تصمیمات و قراردادهای تأییدشده
  - `CHANGELOG.md` — تاریخچه تغییرات
  - `VERSION` — نسخه جاری
  - `AI/EXECUTION_GUIDE.md` — راهنمای اجرای AI
  - `SKILLS/SKILL.md` — دستورالعمل تخصصی توسعه
  - `docs/README.md` — فهرست مستندات
  - `docs/MAINTENANCE.md` — سیاست نگهداری
- تعریف اسناد پایه معماری:
  - `Comprehensive Architecture.txt`
  - `Online Store for Tobacco and Accessories.md`

### Defined
- معماری دو بخشی: Catalog/Shop و Health AI Agent
- وضعیت‌های حقوقی SKU: `APPROVED_ONLINE`, `CATALOG_ONLY`, `IN_PERSON_ONLY`, `REVIEW_REQUIRED`, `BLOCKED`
- Stack فنی: Next.js + Django + PostgreSQL + LangGraph + NeMo Guardrails
- نقشه راه سه‌فازی اجرا

---

<!-- روش مستندسازی:
[Major.Minor.Patch] — YYYY-MM-DD
### Added     → قابلیت یا فایل جدید
### Changed   → تغییر در رفتار موجود
### Fixed     → رفع خطا
### Removed   → حذف قابلیت
### Security  → رفع مشکل امنیتی
### Deprecated → منسوخ‌شده اما هنوز فعال
-->
