```markdown
# Smokeshop — Catalog and Multi-Vendor Infrastructure

Version **0.10.1** · Alpha · 2026-10-12

A Persian, right-to-left (RTL) catalog for accessories, cigarettes, other tobacco products, and general merchandise. The catalog is not restricted to Winston or a 100-product limit: categories and brands are added via the admin panel, and listings support pagination. The 14 vendor-supplied Winston product images are preserved; categories without data do not display placeholder or synthetic products.

The homepage displays up to six featured cigarette models and provides entry points for six categories: Cigarettes, Vape/Pod, Pipe, Hookah, Tobacco, and Accessories. Other items remain accessible under `/catalog`; legacy data has not been removed. Header search queries across all products, and category/brand links initialize filters from URL parameters. Categories without data render an empty state; no synthetic bestseller metrics or fake discounts are displayed.

Final design reference: Owner's visual mockup featuring Theme E — Titanium Silver; graphite/silver palette, Hero section, six visual category cards, six featured products, four showcase panels, and Footer. All existing pages use the shared Design System. Mockup visuals serve strictly as showcase imagery rather than actual SKU/inventory photos; original vendor photos and local smoke effects are preserved. Prior design directions inspired by Davidoff, El Badia, and Hookah.com continue within the catalog structure.

## Implemented Features

0.10.1 Security Validation: The production audit reports zero vulnerabilities, though an unpatched advisory in a development tool propagates into five high-severity findings. Dependencies have not been downgraded or replaced; details, limitations, and the remediation plan are documented in [Security Notes](docs/SECURITY_NOTES.md). CI runs the production audit across both operating systems and executes all 56 E2E tests against a production build and temporary database. Passing the owner's targeted Windows test does not constitute full local suite completion or manual acceptance sign-off.

- Optional tobacco flavor and weight attributes across the admin panel, API, product detail page, and combined filters; options are populated strictly from publicly registered data.
- Persian full-text search along with filters for product type, category, brand, vendor, stock availability, and retail/wholesale; the brand list is derived from the entire visible catalog.
- 18+ self-declaration entry gate with a neutral exit for under-18 visitors and session-only browser persistence; this gate does not constitute formal age verification.
- Responsive mobile/desktop interface using the locally hosted Vazirmatn font, full uncropped product photography, and the Titanium Silver showcase section. Realistic smoke effects play exclusively within the showcase section; text and product cards have no global smoke/blur overlays, motion can be paused, and OS reduced-motion preferences are respected.
- Vendor-independent master catalog items; each `Offer` maintains independent pricing, inventory, identifier, and approval status. Only active vendors and approved offers are publicly visible.
- Vendor selection on the product page, guest shopping cart with separate line items per vendor, payment-free order request submission, and point-in-time snapshots of title, price, and vendor.
- Transactional inventory reservation and duplicate-request prevention; cancellation and expiration release stock exactly once, backed by an Audit Log and inventory ledger.
- Management of products, images, sources, vendors/users, offers, orders, branches, compatibility, and feature flags; vendor access is scoped strictly to their own offers and order line items.
- Fields for manufacturer/brand group, source URL, verification date, and data-limitation notes; unknown unit counts remain `null`.
- Brand and featured-brand pages, search, browser-stored wishlist, real product gallery, login/registration, and Django Auth accounts; guest carts persist upon login, and account order requests are trackable exclusively by the account owner. Checkout supports order request submission only, with no new payment or shipping integrations.
- Server-side purchase policy enforcement, CSRF protection, auxiliary 18+ confirmation, and session isolation; covered by API, PostgreSQL, browser, and CI test suites.

## Quick Start on Windows

Install Python ≥ 3.12 and Node.js ≥ 22.18:

```powershell
Set-Location D:\Smokeshop
py -3.12 scripts/setup.py
py -3.12 scripts/dev.py

```

Storefront: `http://localhost:3000` · Admin: `http://localhost:8000/admin/`

Create a superuser account (one-time setup):

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py createsuperuser

```

On Linux/macOS, use `python3` and `backend/.venv/bin/python`. Docker, AI services, and external API keys are not required for local development. Before upgrading an existing database, stop all running services and take a backup; incremental migration `0007` adds an optional cart owner field, and re-seeding is not required for existing installations.

## Architecture and Current Scope

Built with Next.js + TypeScript and Django + DRF serializers; uses SQLite for development and PostgreSQL for production and row-level locking tests. Core modules reside within the `shop` app. Redis, Celery, RAG, and Health AI are not implemented in this release; comprehensive architecture docs reflect future roadmap designs.

Per project policy, online purchasing of `cigarette` and `tobacco` items is strictly blocked—even if approval flags are misconfigured. Purchasing non-tobacco items requires legal approval, an active category, an enabled `cart` flag, and valid pricing and inventory. `order_requests` only registers payment-free review requests. No payment gateways, shipping providers, vendor settlements, or commission engines are integrated. The current age confirmation is not a legally binding age verification mechanism.

New inventory reservations carry a default 30-minute expiration window (`ORDER_RESERVATION_MINUTES`). The `expire_orders` management command must be triggered by an external scheduler; no automated scheduler is configured in the development setup. Legacy reservations without expiration timestamps are reviewed manually by operators. Remaining production readiness tasks are detailed in the setup guide.

## Documentation

* [Shared Titanium Silver Design System](https://www.google.com/search?q=docs/design/DESIGN_SYSTEM.md)
* [0.10.0 Release Notes, Windows Testing, and Changelog](https://www.google.com/search?q=docs/deployment/PREMIUM_STOREFRONT.md)
* [Installation, Upgrade, Testing, and Production Guide](https://www.google.com/search?q=docs/deployment/LOCAL_SETUP.md)
* [Admin and Vendor Guide](https://www.google.com/search?q=docs/user/ADMIN_GUIDE.md)
* [Data Sources and Specification Completeness Limitations](https://www.google.com/search?q=docs/catalog/PRODUCT_DATA.md)
* [Catalog and Purchase API Contract](https://www.google.com/search?q=docs/api/CATALOG_API.md)
* [Project Status and Remaining Tasks](PROJECT_CONTEXT.md)
* [Architectural Decisions](https://www.google.com/search?q=PROJECT_DECISIONS.md) · [Changelog](CHANGELOG.md) · [Documentation Index](https://www.google.com/search?q=docs/README.md) · [Development Rules](AGENTS.md)

```

```




# اسموک‌شاپ — کاتالوگ و زیرساخت چندفروشندگی

نسخه **0.12.0** · Alpha · 2026-10-27

کاتالوگ فارسی و راست‌به‌چپ برای اکسسوری، سیگار، سایر دخانیات و سایر کالاها. کاتالوگ به وینستون یا ۱۰۰ محصول محدود نیست: دسته‌ها و برندها از ادمین اضافه می‌شوند و فهرست صفحه‌بندی دارد. ۱۴ تصویر وینستونِ ارسالی فروشنده حفظ شده‌اند؛ دسته‌های بدون داده، محصول ساختگی نمایش نمی‌دهند.

صفحهٔ اصلی حداکثر شش مدل منتخب سیگار را نمایش می‌دهد و ورودی شش دستهٔ سیگار، ویپ/پاد، پیپ، قلیان، تنباکو و اکسسوری دارد. سایر اقلام همچنان در `/catalog` هستند؛ داده‌های قدیمی حذف نشده‌اند. جست‌وجوی هدر همهٔ کالاها را جست‌وجو می‌کند و لینک دسته/برند، فیلتر اولیه را از URL دریافت می‌کند. دسته‌های بدون داده حالت خالی دارند؛ آمار پرفروش یا تخفیف ساختگی نمایش داده نمی‌شود.

مرجع نهایی طراحی: ماکاپ تصویری مالک با تم E — Titanium Silver؛ پالت گرافیتی/نقره‌ای، Hero، شش دسته تصویری، شش محصول منتخب، چهار پنل معرفی و Footer. تمام صفحات موجود از Design System مشترک استفاده می‌کنند. تصاویر ماکاپ فقط تصویر معرفی‌اند و عکس SKU/موجودی واقعی نیستند؛ عکس‌های اصلی فروشنده و دود محلی حفظ شده‌اند. جهت‌های قبلی Davidoff/El Badia/Hookah.com در ساختار کاتالوگ ادامه دارند.

## اصلاحات آمادگی تولید در feature/production-readiness

پنل /manage برای نقش‌های فعلی، ویرایش و CSV قیمت/موجودی با پیش‌نمایش امضاشده، دسترسی محدود فروشنده، SEO فنی با SITE_URL و تصاویر واکنش‌گرا اضافه شده‌اند. Next.js و eslint-config-next به patch سازگار 16.4.3 ارتقا یافته‌اند؛ گزارش امنیت 2026-10-12 تاریخی است و وضعیت تازه در Security Notes ثبت می‌شود. گزارش اجرای همین مرحله در docs/implementation/SMOKESHOP_CODEX_AUTONOMOUS_FIXES.md است. پرداخت، مالیات/کارمزد، ارسال، تسویه و استقرار تولید همچنان کامل نشده‌اند. وضعیت main مبنا: PR #4 merged در 2026-10-12؛ اصلاحات جاری merge/deploy نشده‌اند.

## امکانات اجراشده

نسخهٔ شاخهٔ کاری 0.13.0 است؛ main هنوز نسخهٔ پایهٔ 0.10.1 را دارد. پنل `/manage` اکنون فرم روزمرهٔ کالا/تصویر/فروشنده/عرضه و جزئیات و لغو رزرو را در خود دارد. وضعیت تست هر commit در PR #5 و سند اجرای موجود ثبت می‌شود؛ پذیرش دستی و استقرار تولید جدا و انجام‌نشده‌اند. یادداشت امنیتی تاریخی 0.10.1 با patchهای شاخهٔ کاری جایگزین شده؛ محدوده و شواهد در [Security Notes](docs/SECURITY_NOTES.md) آمده است.

- طعم و وزن اختیاری تنباکو در ادمین، API، صفحهٔ محصول و فیلترهای ترکیبی؛ گزینه‌ها فقط از داده عمومی ثبت‌شده هستند.
- جست‌وجوی فارسی، فیلتر نوع، دسته، برند، فروشنده، موجودی و تکی/عمده؛ فهرست برندها از کل کاتالوگ قابل نمایش می‌آید.
- دروازهٔ خوداظهاری۱۸+ برای ورود، با خروج خنثی برای زیر۱۸سال و یادآوری فقط در همان نشست مرورگر؛ این دروازه احراز رسمی سن نیست.
- رابط موبایل/دسکتاپ با فونت محلی وزیرمتن؛ عکس کامل محصولات و بخش معرفی Titanium Silver. دود واقعی فقط در بخش معرفی پخش می‌شود؛ متن و محصولات لایه دود/تاری سراسری ندارند، حرکت قابل توقف است و کاهش حرکت دستگاه رعایت می‌شود.
- کالای مرجع مستقل از فروشنده؛ هر عرضه (`Offer`) قیمت، موجودی، شناسه و تأیید مستقل دارد. فقط فروشندگان فعال و عرضه‌های تأییدشده عمومی‌اند.
- انتخاب فروشنده در صفحه کالا، سبد مهمان با ردیف مستقل هر فروشنده، ثبت درخواست بدون پرداخت و snapshot عنوان/قیمت/فروشنده.
- رزرو تراکنشی و جلوگیری از تکرار درخواست؛ لغو و انقضا با آزادسازی موجودی دقیقاً یک‌بار، Audit Log و دفتر موجودی.
- مدیریت کالا/تصویر/منبع، فروشنده/کاربران، عرضه‌ها، سفارش‌ها، شعبه، سازگاری و flagها؛ دسترسی محدود فروشنده به عرضه و ردیف سفارش خودش.
- فیلد تولیدکننده/گروه برند، URL منبع، تاریخ بررسی و یادداشت محدودیت داده؛ تعداد واحد نامعلوم `null` می‌ماند.
- صفحات برند/برند منتخب، جست‌وجو، علاقه‌مندی مرورگر، گالری واقعی، ورود/ثبت‌نام و حساب Django Auth؛ سبد مهمان هنگام ورود حفظ و درخواست‌های حساب فقط برای صاحب حساب قابل پیگیری‌اند. Checkout فقط ثبت درخواست موجود است؛ پرداخت/ارسال جدید ندارد.
- کنترل سیاست خرید در سرور، CSRF، تأیید کمکی ۱۸+ و جداسازی نشست‌ها؛ تست API، PostgreSQL، مرورگر و CI.

## شروع سریع در ویندوز

Python ≥ 3.12 و Node.js ≥ 22.18 نصب کنید:

```powershell
Set-Location D:\Smokeshop
py -3.12 scripts/setup.py
py -3.12 scripts/dev.py
```

فروشگاه: `http://localhost:3000` · ادمین: `http://localhost:8000/admin/`

مدیر را یک‌بار بسازید:

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py createsuperuser
```

در Linux/macOS از `python3` و `backend/.venv/bin/python` استفاده کنید. Docker، سرویس AI و کلید خارجی برای توسعه لازم نیست. قبل از ارتقای پایگاه موجود، سرویس‌ها را متوقف و backup تهیه کنید؛ migration افزایشی `0007` مالک اختیاری سبد را اضافه می‌کند؛ برای نصب موجود seed مجدد لازم نیست.

## معماری و محدوده واقعی

Next.js + TypeScript، Django + DRF serializers؛ SQLite برای توسعه، PostgreSQL برای تولید و آزمون قفل سطری. ماژول‌ها در برنامه `shop` هستند. Redis، Celery، RAG و Health AI در این نسخه اجرا نشده‌اند؛ اسناد جامع طرح آینده‌اند.

طبق سیاست پروژه، خرید آنلاین `cigarette` و `tobacco` حتی با تنظیم اشتباه تأیید، مسدود است. خرید اقلام غیردخانی به تأیید حقوقی، دسته فعال، flag `cart` و قیمت/موجودی معتبر نیاز دارد. `order_requests` فقط درخواست بررسی بدون پرداخت ثبت می‌کند. هیچ درگاه، ارسال، تسویه یا کمیسیون فروشندگان وصل نیست. تأیید سن فعلی احراز قانونی سن نیست.

رزرو جدید مهلت پیش‌فرض ۳۰ دقیقه دارد (`ORDER_RESERVATION_MINUTES`). فرمان `expire_orders` باید توسط زمان‌بند اجرا شود؛ زمان‌بند خودکار در نصب توسعه ساخته نمی‌شود. رزروهای قدیمیِ بدون مهلت را اپراتور بررسی می‌کند. امکانات تولیدِ باقی‌مانده در راهنمای نصب آمده‌اند.

## مستندات

- [Design System مشترک Titanium Silver](docs/design/DESIGN_SYSTEM.md)

- [دریافت نسخه 0.10.0، تست ویندوز و گزارش تغییرات](docs/deployment/PREMIUM_STOREFRONT.md)
- [نصب، ارتقا، تست و تولید](docs/deployment/LOCAL_SETUP.md)
- [راهنمای ادمین و فروشندگان](docs/user/ADMIN_GUIDE.md)
- [منابع داده و محدودیت تکمیل مشخصات](docs/catalog/PRODUCT_DATA.md)
- [قرارداد API کاتالوگ و خرید](docs/api/CATALOG_API.md)
- [وضعیت و کارهای باقی‌مانده](PROJECT_CONTEXT.md)
- [تصمیمات](PROJECT_DECISIONS.md) · [تاریخچه](CHANGELOG.md) · [فهرست مستندات](docs/README.md) · [قواعد توسعه](AGENTS.md)



## افزوده‌های 0.12.0

حساب خصوصی /supplier، تنظیمات و نقش‌ها در /manage، ورودی XLSX و درخواست تأمینِ بدون پرداخت اقلام غیردخانی اضافه شده‌اند. [راهنمای پنل](docs/user/ADMIN_GUIDE.md) و [ارتقای لوکال](docs/deployment/LOCAL_SETUP.md) مرجع‌اند. backup و migrate لازم است؛ seed یا وابستگی تازه لازم نیست. نرخ‌ها پیش‌نویس‌اند و پرداخت/SMS/ارسال واقعی متصل نشده‌اند.

### مدیریت یکپارچه — 0.13.0

/manage با منوی گروه‌بندی‌شده، فیلتر وضعیت و پروندهٔ فقط‌خواندنی مشتری تکمیل شد. مجوز shop.view_customer را مدیر ارشد به کارکنان لازم بدهد؛ تاریخچهٔ سفارش/درخواست تأمین مجوز جدا می‌خواهد. migration0010 لازم است؛ وابستگی تازه و seed لازم نیست. جزئیات اجرا/محدودیت در راهنمای پنل و PROJECT_CONTEXT آمده است.
