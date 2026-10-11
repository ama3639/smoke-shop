# بازطراحی فروشگاه — نسخه 0.8.0

تاریخ: 2026-10-11 · برنچ توسعه: `feature/premium-storefront`

## ادغام و وضعیت انتشار

با مجوز صریح مالک، PR #1 از `feature/catalog-marketplace` در `main` ادغام شد.
main قبل: `94f6e43f753a8041c2af4daf92fb219fcb506014`؛ head کاتالوگ: `39030afc018f5ee7ed9f76fb3dbf6f5a7c74c120`؛ merge: `88f532a19b4b7eccb6388cc73ba4ada55f610535`.
برنچ کاتالوگ دو commit جلوتر و صفر commit عقب‌تر از main بود؛ تعارض نداشت. CI validate همان head موفق بود.
برنچ قدیمی حذف نشده است. بازطراحی در برنچ جدید برای تست است؛ در main ادغام و در تولید مستقر نشده است.

## قبل و بعد

| قبل | بعد |
|---|---|
| هدر شامل لینک‌ها و سبد | جست‌وجوی سراسری، ناوبری دسته‌ها و مسیرهای خدماتی جدا |
| شروع مرور از فهرست سیگار | ورودی چهار دسته و برندهای واقعاً ثبت‌شده، سپس همان فهرست سیگار |
| URL کاتالوگ فقط type/vendor/mode را اعمال می‌کرد | q/category/brand هم در دریافت اولیه و کنترل‌ها اعمال می‌شوند |
| فیلترهای انتخاب‌شده فقط در کنترل‌ها | نمایش انتخاب‌ها و حذف جداگانه/بازنشانی |
| تأیید سن فقط در خرید | دروازهٔ خوداظهاری۱۸+ برای ورود؛ تأیید جداگانهٔ خرید حفظ است |
| markup کارت و دریافت سرور در فایل‌های بزرگ/تکراری | ProductCard، CatalogSections و readCatalog با مسئولیت مشخص |

عکس‌های واقعی وینستون، object-fit:contain، دود محلی hero با توقف/کاهش حرکت، API، SQL، رزرو، نقش‌ها و سیاست خرید backend حفظ‌اند. فایل backend و migration جدیدی در این مرحله تغییر نکرده است. هیچ محصول، قیمت، موجودی، آمار پرفروش یا تخفیف از روی حدس اضافه نشده است.

## گروه‌های ویپ/پاد و پیپ

ورودی‌ها از `/catalog?category=vape-pod` و `/catalog?category=pipe` استفاده می‌کنند.
دسته و کالا باید با همان slug و اطلاعات واقعی در ادمین ثبت شوند. دادهٔ ثبت‌نشده نتیجهٔ خالی دارد. نوع و اجازهٔ خرید کالا مستقل از نام دسته و نیازمند بررسی واقعی‌اند؛ این تغییر آن‌ها را فعال نمی‌کند.
برندهای ردیف هوم‌پیج از facets سیگار می‌آیند؛ برندهای همه کالاها در فیلتر کاتالوگ هستند.
فیلترهای تعاملی در همان صفحه کار می‌کنند؛ بارگذاری مجدد پارامترهای لینک اولیه را دوباره اعمال می‌کند.

دروازهٔ سن از dialog بومی برای حبس تمرکز و جلوگیری از بستن با Escape استفاده می‌کند؛ انتخاب بزرگسال فقط در sessionStorage همان نشست ذخیره می‌شود و زیر۱۸سال به صفحهٔ خنثی about:blank خارج می‌شود. این خوداظهاری UI است، نه احراز رسمی یا محدودسازی API عمومی. کنترل‌های خرید سرور تغییری ندارند.

## pull در ویندوز

دو سرویس توسعه را با Ctrl+C همان پنجره متوقف کنید. اگر `git status --short` تغییر نشان داد، پیش از switch/pull آن را حفظ کنید؛ این راهنما reset/stash اجباری ندارد.

```powershell
Set-Location D:\Smokeshop
git status --short
git fetch origin
git switch feature/premium-storefront
git pull --ff-only origin feature/premium-storefront
git branch --show-current
git rev-parse HEAD
python --version
node --version
python scripts/setup.py
```

در نخستین switch، Git برنچ ریموت هم‌نام را دنبال می‌کند. اگر tracking خودکار غیرفعال است و برنچ محلی هنوز وجود ندارد، به‌جای همان switch از `git switch --track origin/feature/premium-storefront` استفاده کنید. اگر pull به دلیل واگرایی متوقف شد، reset نکنید؛ ابتدا اختلاف را بررسی کنید.
Python≥3.12 و Node≥22 لازم‌اند. setup نصب وابستگی‌ها، migration/نقش‌ها و seed تکرارپذیر موجود را اجرا می‌کند؛ upgrade۰.۸ migration تازه ندارد. DB، upload، secret و دادهٔ ویرایش‌شده جایگزین نمی‌شوند. قبل از setup روی دادهٔ مهم، backup طبق LOCAL_SETUP داشته باشید.

## تست خودکار

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py check
.\backend\.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
.\backend\.venv\Scripts\python.exe backend\manage.py test shop
Set-Location D:\Smokeshop\frontend
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E از دیتابیس موقت و پورت‌های8010/3010 استفاده می‌کند، نه DB توسعه؛ این پورت‌ها باید آزاد باشند. داده‌های خرید و فروشندگان در fixture فقط آزمایشی‌اند. ۱۸ سناریو برای دسکتاپ و موبایل، مجموع۳۶ مورد تعریف شده‌اند. تست‌های معمول UI در fixture از دروازهٔ سن عبور می‌کنند؛ دو سناریوی مستقل پذیرش/رد سن، خود دروازه را تست می‌کنند.
SQLite تست هم‌زمانی PostgreSQL را skip می‌کند؛ نتیجهٔ SQLite تأیید قفل سطری نیست. CI همین suite را با PostgreSQL16 اجرا می‌کند.

## اجرای دستی

```powershell
Set-Location D:\Smokeshop
python scripts/dev.py
```

فروشگاه: http://localhost:3000 · ادمین: http://localhost:8000/admin/
در صورت نداشتن مدیر، یک‌بار: `.\backend\.venv\Scripts\python.exe backend\manage.py createsuperuser`.

بررسی دستی: ورود۱۸+ و خروج زیر۱۸سال در نشست جدا؛ دسته‌های چهارگانه و حالت خالی؛ جست‌وجوی کامپکت؛ فیلتر/حذف برند و دسته؛ عکس کامل و بازشدن محصول با یک کلیک؛ دود با توقف و reduced-motion؛ سبد/انتخاب فروشنده برای fixture یا کالای واقعاً مجاز؛ عرض‌های320/390/768/1440.

## گزارش اعتبارسنجی

- محیط محلی: Linux، Python3.12.14، Node24.19.0؛ Next16.4.0 با وابستگی‌های lock.
- baseline: typecheck موفق؛ backend جمعاً۴۷ تست، ۴۲ موفق و ۵ آزمون ویژه PostgreSQL skip؛ check و عدم migration تازه موفق.
- نسخهٔ جدید: typecheck و build تولید محلی موفق‌اند؛ check و عدم migration تازه نیز موفق‌اند. اجرای محلی نمونهٔ E2E به دلیل نبود executable مرورگر پیش از اجرای تعامل متوقف شد؛ این PASS نیست.
- CI نهایی روی commit `b039cb3c04a2486caebb4d656338b889877283fa`: [اجرای 38177261491](https://github.com/ama3639/smoke-shop/actions/runs/38177261491) موفق؛ هر۴۷ تست backend روی PostgreSQL16 بدون skip، هر۳۶ تست مرورگر دسکتاپ/موبایل بدون شکست، typecheck، build و کنترل migration موفق. دو انتخابگر مبهم تست اصلاح شدند؛ ارتفاع hero با متن چندخطی هماهنگ و عدم هم‌پوشانی متن/کنترل‌ها در مرورگر تست شد. اسکرین‌شات کامل پس از بارگذاری عکس‌ها در artifact ذخیره است.
- commit بعدی فقط تاریخ و گزارش مستندات را تکمیل می‌کند؛ SHA بالا مبنای تست کد است. [PR شمارهٔ۲](https://github.com/ama3639/smoke-shop/pull/2) برای بازبینی و تست مالک draft باقی مانده است. مقایسهٔ tree هر۶۰ فایل backend و دارایی رسانه‌ای را با baseline یکسان نشان داد.
- مرورگر محلی: دانلود Chromium156 از CDN به‌جای ZIP، HTML195بایتی برگرداند؛ نصب شکست خورد. در این محیط E2E تصویری محلی تأیید نشده است. فایل‌های بزرگ hero/فیلم از رابط دریافت فایل محلی کامل دریافت نشدند؛ فایل‌های اصلی در Git بدون تغییر حفظ‌اند و checkout CI همان دارایی‌های واقعی را دارد.
- PostgreSQL محلی، Windows واقعی و production در این محیط تست نشده‌اند؛ CI/تست مالک جدا گزارش می‌شوند.

## فایل‌های تغییرکرده

- جدید: `frontend/components/age-gate.tsx`، `catalog-sections.tsx`، `product-card.tsx`، `frontend/lib/catalog-data.ts` و همین runbook.
- رابط: `frontend/app/page.tsx`، `catalog/page.tsx`، `layout.tsx`، `globals.css`، `frontend/components/chrome.tsx`، `motion-scene.tsx` و `storefront.tsx`.
- تست/نسخه: `frontend/tests/store.spec.ts`، `.github/workflows/ci.yml`، `VERSION`، `frontend/package.json` و `package-lock.json`؛ dependency upgrade ندارد.
- اسناد جاری: README، CHANGELOG، PROJECT_CONTEXT، PROJECT_DECISIONS، AGENTS، AI/EXECUTION_GUIDE، SKILLS/SKILL، docs/README، docs/MAINTENANCE، docs/deployment/LOCAL_SETUP و docs/api/CATALOG_API.
- فایل حذف‌شده: ندارد. انتقال به لوکال با pull همین برنچ انجام شود؛ .env، DB، media و secret وارد Git نمی‌شوند.
