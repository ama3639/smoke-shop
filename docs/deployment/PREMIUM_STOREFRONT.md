# Titanium Silver — تحویل 0.10.0

تاریخ2026-10-12. مخزن `ama3639/smoke-shop`، برنچ `feature/titanium-silver-storefront`؛ مبنای واقعی ریموت `c66a48fc62deca8be28ed6e145f7b15e5f26c8a3`. PRهای #3 و #2 طبق دستور قبلی ادغام شدند. [PR #4](https://github.com/ama3639/smoke-shop/pull/4) نسخه جاری را برای review نگه می‌دارد؛ main/Production برای این تغییر منتشر نمی‌شوند. Acceptance مالک جدا و فعلاً NOT RUN است.

## قبل و بعد

| بخش | قبل0.9 | بعد0.10 |
|---|---|---|
| تم | معرفی روشن با پالت قبلی | Design System گرافیتی/نقره‌ای مشترک مطابق ماکاپ مالک |
| Homepage |۱۴مدل و معرفی گروهی | Hero، دود، خدمات واقعی،۶دسته تصویری،۶منتخب،۴پنل،Footer |
| صفحات | کاتالوگ/کالا/سبد/اطلاعات | یکپارچه‌سازی همه و صفحات برند، جست‌وجو، علاقه‌مندی، Checkout و حساب |
| حساب | نشست مهمان | Django Auth، سبد حفظ‌شده هنگام ورود، تاریخچه خصوصی، پروفایل |
| DB | Cart بدون مالک حساب | user nullable با migration0007؛ داده قبلی حفظ |
| تست Windows | Python نسبی و CDN403 | مسیر مطلق Python و Edge/Chrome نصب‌شده |

عکس‌های واقعی۱۴مدل و دارایی‌های قدیمی حذف/بازنویسی نشده‌اند. تصاویر ماکاپ معرفی‌اند و موجودی/عکسSKU نیستند. کالاهای سیگار/تنباکو همچنان در API قابل خرید اینترنتی نیستند. Checkout فقط درخواست بررسی/رزرو است؛ پرداخت/ارسال/تسویه اضافه نشده است. علاقه‌مندی browser-local است؛ بازیابی رمز/سرویس ایمیل و احراز رسمی سن در دامنه این نسخه نیستند.

## ارتقای نصب موجود — PowerShell مستقل

فرض: پروژه در D:\Smokeshop و دیتابیس پیش‌فرض SQLite است. ابتدا اجرای dev قبلی را با Ctrl+C متوقف کنید. اگر DATABASE_URL دارید، از همان PostgreSQL backup بگیرید؛ Copy-Item زیر فقط SQLite را پوشش می‌دهد. تغییرات محلی را حفظ کنید؛ در صورت dirty بودن، بدون reset/clean ادامه ندهید.

```powershell
Set-Location D:\Smokeshop
```

```powershell
git status --short
```

```powershell
if (@(git status --porcelain).Count -gt 0) { throw "Local changes exist; preserve them before switching branches." }
```

```powershell
git fetch origin
```

```powershell
git switch feature/titanium-silver-storefront
```

```powershell
git pull --ff-only origin feature/titanium-silver-storefront
```

```powershell
git log -1 --oneline
```

```powershell
if (Test-Path .\backend\db.sqlite3) { Copy-Item .\backend\db.sqlite3 "..\smoke-shop-before-0.10.0-$(Get-Date -Format yyyyMMdd-HHmmss).sqlite3" }
```

```powershell
if (-not (Test-Path .\backend\.venv\Scripts\python.exe)) { py -3.12 -m venv backend\.venv }
```

```powershell
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

```powershell
npm --prefix frontend ci
```

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py migrate
```

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py check
```

برای نصب موجود setup/seed_demo تکرار نشود. نصب تازه و بدون داده قبلی: `py -3.12 scripts/setup.py` محیط/نقش/کاتالوگ اولیه را می‌سازد. Python3.12+ و Node22.18+ لازم‌اند؛ CI با Python3.12 و Node24 اجرا می‌شود.

## اجرای محلی

روش مشترک، هر دو سرویس؛ Ctrl+C فقط فرزندان همین اجرا را متوقف می‌کند:

```powershell
Set-Location D:\Smokeshop
```

```powershell
.\backend\.venv\Scripts\python.exe scripts\dev.py
```

یا دو ترمینال جدا؛ با روش مشترک هم‌زمان اجرا نکنید:

Backend — ترمینال اول:

```powershell
Set-Location D:\Smokeshop
```

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000 --noreload
```

Frontend — ترمینال دوم:

```powershell
Set-Location D:\Smokeshop
```

```powershell
npm --prefix frontend run dev
```

فروشگاه: http://localhost:3000 · ادمین: http://localhost:8000/admin/ . ورود/ثبت‌نام مشتری در /login و /register است؛ حساب مشتری دسترسی ادمین نمی‌دهد. مدیر فقط اگر از قبل ندارید:

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py createsuperuser
```

## تست و Build — ترمینال جدا

```powershell
Set-Location D:\Smokeshop
```

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py check
```

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
```

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py test shop
```

```powershell
npm --prefix frontend run lint
```

```powershell
npm --prefix frontend run test:unit
```

```powershell
npm --prefix frontend run typecheck
```

```powershell
npm --prefix frontend run build
```

```powershell
npm --prefix frontend run test:e2e
```

E2E ابتدا Build تولید جداگانه می‌سازد و سپس next start را اجرا می‌کند؛ برای آماده‌شدن حداکثر۱۸۰ثانیه زمان دارد. E2E پورت8010/3010 و دیتابیس SQLite موقت دارد؛ DATABASE_URL محیط برای E2E عمداً کنار گذاشته می‌شود. dev اصلی8000/3000 می‌تواند جدا بماند. `.next-e2e` از build اصلی جداست. Playwright فقط `*.spec.ts` می‌خواند؛ Unit Tests جدا اجرا می‌شوند.

## راهکار Chromium403 در Windows

Config ابتدا PLAYWRIGHT_BROWSER_CHANNEL، سپس PLAYWRIGHT_CHROMIUM_EXECUTABLE و سپس Edge/Chrome مسیرهای نصب معمول را استفاده می‌کند. Edge/Chrome نصب‌شده دانلود Chromium لازم ندارد. اجبار Edge در ترمینال تست:

```powershell
$env:PLAYWRIGHT_BROWSER_CHANNEL = "msedge"
```

```powershell
npm --prefix frontend run test:e2e
```

یا کانال `chrome` برای Chrome نصب‌شده. اگر نصب مسیر متفاوت دارد:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
```

```powershell
Remove-Item Env:PLAYWRIGHT_BROWSER_CHANNEL -ErrorAction SilentlyContinue
```

```powershell
npm --prefix frontend run test:e2e
```

در محیط دارای دسترسی CDN و بدون مرورگر نصب‌شده، از frontend فرمان `npx playwright install chromium` اجرا شود. فایل ناقص/خطای403 PASS نیست؛ مرورگر واقعی یا CI لازم است.

## PostgreSQL واقعی برای پنج تست SQLite-SKIP

CI validate از PostgreSQL16 واقعی و دیتابیس اختصاصی استفاده می‌کند. SQLite قفل سطری/هم‌زمانی را اثبات نمی‌کند. جایگزین اختیاری لوکال با Docker Desktop و نام/پورت اختصاصی؛ این فرمان سرویس‌های دیگر را تغییر نمی‌دهد:

```powershell
docker run --name smoke-shop-pg-test-010 --detach --env POSTGRES_USER=smoke --env POSTGRES_PASSWORD=local-test-only --env POSTGRES_DB=smoke_test --publish 127.0.0.1:55432:5432 postgres:16-alpine
```

```powershell
docker exec smoke-shop-pg-test-010 pg_isready -U smoke -d smoke_test
```

پس از accepting connections، فقط در ترمینال تست:

```powershell
$env:DATABASE_URL = "postgresql://smoke:local-test-only@127.0.0.1:55432/smoke_test"
```

```powershell
$env:DB_SSLMODE = "disable"
```

```powershell
.\backend\.venv\Scripts\python.exe backend\manage.py test shop --noinput
```

پس از تست، متغیرهای تست همان ترمینال را پاک کنید؛ این مسیر را برای migrate دیتابیس اصلی استفاده نکنید:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

```powershell
Remove-Item Env:DB_SSLMODE -ErrorAction SilentlyContinue
```

```powershell
docker stop smoke-shop-pg-test-010
```

اگر کانتینر از قبل وجود دارد، دوباره docker run یا حذف خودکار نکنید؛ همان نمونه اختصاصی را بررسی و در صورت نیاز start کنید. رمز بالا فقط برای دیتابیس آزمون loopback است.

## Validation ثبت‌شده

| محیط/بررسی | وضعیت | شاهد |
|---|---|---|
| Local Linux/Python3.12.14/Node24.19 | PASS جزئی | check، migration consistency، ESLint، TypeScript،۳Unit،build |
| Backend SQLite | PASS / SKIP |۵۸کشف:۵۳PASS و۵SKIP PostgreSQL؛ تست عدم ساخت نشست درGET سبد اضافه شد |
| ارتقا0006→0007 SQLite موقت | PASS | ID و تمام فیلدهای موجود Category/Product/Cart/CartItem/Order حفظ؛user_id=null |
| اجرای واقعی next start با Backend موقت | PASS | /:۶کارت؛catalog:۱۸؛hookah:۰؛accessory:۱؛نعناع250:۱؛همگی200 |
| دارایی runtime | PASS | ماکاپPNG و هر دو فیلم دود پاسخ200 |
| مرورگر Local | BLOCKED | CDN فایل ZIP ناقص؛ executable نصب نشد؛ تست تعامل محلی اجرا نشد، اما CI واقعی Linux/Windows موفق شد |
| CI Linux/PostgreSQL در636bf70 | PASS | [38230687374](https://github.com/ama3639/smoke-shop/actions/runs/38230687374):۵۸Backend بدونSKIP و۵۶E2E؛Lint/۳Unit/TypeScript/Build موفق |
| CI Windows/Edge نصب‌شده در636bf70 | PASS / SKIP | همانCI:۵۶E2E،۵۳Backend و۵SKIP مخصوصPostgreSQL؛build/typecheck/lint/۳unit موفق |
| Acceptance دستگاه مالک | NOT RUN | پس از pull و checklist زیر |
| Production/Load/Core Web Vitals | NOT RUN | Production Deploy مجاز نیست؛ تست بار/ممیزی جامعWCAG در این کار اجرا نشده |

## چک‌لیست Acceptance دستی مالک

برای هر ردیف در مرورگر خود PASS/FAIL ثبت کنید؛ وضعیت همه ردیف‌ها فعلاً **NOT RUN توسط مالک** است. در تمام مسیرها: پالت/قاب/فونت مطابق مرجع، RTL، عرض320/390/768/Desktop، بدون اسکرول افقی صفحه، focus صفحه‌کلید، تصاویر بدون شکست و خطای Console بررسی شود. فقط منوی موبایل می‌تواند داخل خودش افقی scroll کند.

| صفحه/مسیر | بررسی مالک |
|---|---|
| / | Header/Search، ترتیب۶دسته، Hero تصویر/متن،۶منتخب واقعی،۴پنل،خدمات وFooter مطابق ماکاپ |
| / — Motion | دود داخلHero، توقف/ادامه، توقف خارج دید/تب مخفی، reduced-motion بدون ویدئو |
| دروازه۱۸+ | نخستین ورود، adult صریح، Escape دور نمی‌زند، یادآوری نشست، خروج زیر۱۸سال |
| /catalog | همه کالاها، جست‌وجوی فارسی/عربی، pagination، حذف/پاک‌کردن فیلتر، خطا/تلاش دوباره |
| /catalog?type=cigarette |۱۴مدل فعلی در DB اولیه، تکی/باکس/برند، عکسcontain، کلیک/لمس/Enter |
| /catalog?category=vape-pod | مسیر واقعی و حالت خالی تا داده معتبر |
| /catalog?category=pipe | مسیر واقعی و حالت خالی تا داده معتبر |
| /catalog?category=hookah | معرفی/دسته/لینک اکسسوری، حالت خالی واقعی |
| /catalog?type=tobacco | برند+دسته+طعم+وزن ترکیبی، URL/reload، unknown خالی، بدون خرید |
| /catalog?type=accessory | اکسسوری‌های موجود حفظ؛ فقط کالا/عرضه واقعاً مجاز قابل خرید |
| /products/winston-silver و دیگر SKUها | مشخصات/منبع/نامعلوم، عکس اصلی، گالری بزرگ‌نمایی، Escape/focus، قلب، related واقعی |
| /products کالای مجاز | فروشنده، تعداد معتبر، تأیید۱۸+، افزودن، شمارنده هدر؛ هیچ خرید سیگار/تنباکو |
| /brands و /brands/Winston | برندهای واقعی، کلیک، فیلتر اولیه، برند ناشناخته404 |
| /search?q=XS | search هدر و نتیجه واقعی؛ normalized query و reload |
| /wishlist | افزودن/حذف بدون navigation ناخواسته، count،reload،empty،کالای unavailable |
| /cart | guest،محصول/فروشنده/تعداد/مبلغ واقعی،حذف،flag،empty،link Checkout |
| /checkout | مبلغ سرور،ثبت یک درخواست،رزرو/پیگیری،بدون ادعای پرداخت،تکرار ناخواسته ندارد |
| /orders/UUID | فقط مالک،snapshot فروشنده/قیمت،وضعیت/مهلت،نشست یاحساب دیگر404 |
| /register | رمز/تکرار/age،نام/ایمیل اختیاری،خطای معتبر،user عادی،سبد guest حفظ |
| /login | ورود صحیح/خطا،CSRF،حفظ سبد،linkregister،بدون دسترسی ادمین |
| /account | نام/ایمیل،ذخیره/خطا،تاریخچه خصوصی/pagination،Logout/Login وپیگیری حساب |
| /sellers | فقط فروشندگان فعال وlinkcatalog همان فروشنده |
| /branches | اطلاعات واقعی یا empty صادقانه؛ داده ساختگی نیست |
| /guide و /policy | Typography/palette و لینک‌ها؛ شرح حساب/کوکی/علاقه‌مندی/درخواست فعلی |
| /products/not-a-product و برندناشناخته |404 خوانا،navigation وFooter حفظ |
| /admin/ روی8000 | مدیر قبلی،کالا/طعم/وزن/offer/roles،شناسه/قیمت/موجودی قبلی حفظ؛ Django Admin تم اختصاصی خودش را دارد |

سناریوی خرید مثبت به **اکسسوری مجاز واقعی** نیاز دارد؛ seed توسعه فروش را فعال نمی‌کند. بدون داده موردنیاز، آن ردیف را BLOCKED/NOT RUN ثبت کنید، flag عمومی را صرفاً برای زیبایی UI تغییر ندهید. داده آزمایشی E2E فقط در DB موقت خودش است و نباید به نصب اصلی منتقل شود.

## Git و بازگشت

PR #4 open،merge نهایی و Production Deploy انجام نشده. commit نهایی و لینک CI در گزارش PR/تحویل ثبت می‌شوند. workspace ادامه از یک نسخه محلی با تاریخچه کپی‌شده بود؛ تغییرهای مجاز فقط روی parent واقعی c66a48f در ریموت اعمال شدند، فایل‌های نامرتبط ریموت حفظ‌اند.

برای برگشت توسعه، ابتدا سرویس‌ها را متوقف و از وضعیت فعلی backup بگیرید. اجرای reset/clean یا migration معکوس خودکار مجاز نیست؛ نسخه کد و backup سازگار را در محیط جدا بررسی کنید. برگشت به0.9 مالک حساب را پشتیبانی نمی‌کند و نباید روی DB مهاجرت‌یافته بدون تصمیم بازیابی اجرا شود.


## اصلاحات Validation

- دریافت سبد خالی مهمان بدون کوکی نشست، Cart/Session جدید نمی‌سازد؛ پاسخ API همان شکل قبلی دارد. این تغییر رقابت Set-Cookie شمارندهٔ هدر با تأیید ۱۸+ را حذف می‌کند. تست اختصاصی کوکی غایب/منقضی و افزودن پس از تأیید را پوشش می‌دهد. شمار فعلی backend برابر ۵۸ است؛ ۵۷ مربوط به اجرای قبل از این اصلاح است.
- E2E مطابق راهنمای نسخهٔ نصب‌شدهٔ Next.js، روی build/start تولید اجرا می‌شود. زمان بررسی ۲۳ مسیر پنج دقیقه است؛ هیچ assertion حذف نشده است. بازشدن مرورگر حداکثر۳۰ثانیه و آماده‌شدن سرور۱۸۰ثانیه زمان دارد. CI ویندوز بعد از اولین خطای نهایی متوقف می‌شود؛ اجرای موفق همچنان همهٔ۵۶تست را انجام می‌دهد.
- قبل از اسکرین‌شات کامل، تصاویر قابل‌نمایش در مرورگر آزمون eager می‌شوند، به دید می‌آیند و naturalWidth مثبت و decode با مهلت۵ثانیه تأیید می‌شود. سپس صفحه به بالا برمی‌گردد. انتظار نامحدود برای تصویر lazy خارج از دید وجود ندارد؛ این تنظیم فقط برای ثبت شواهد است و loading تصاویر سایت را تغییر نمی‌دهد. Checkout پس از نمایش ردیف سبد ثبت می‌شود.

## شواهد نهایی تصویری و دامنه

Artifact اجرای [38230687374](https://github.com/ama3639/smoke-shop/actions/runs/38230687374) در Linux شامل۶۰فایل است:۴۶اسکرین‌شات مسیرهای Desktop/Mobile، گالری هر دو اندازه، حساب دارای درخواست و Checkout دارای ردیف. Hero بدون نوشتهٔ تکراری ماکاپ، عکس‌های کامل۱۴مدل، thumbnail جدا و Checkout پس از بارگذاری بررسی شدند. Acceptance مالک هنوز NOT RUN است.

۳۵دارایی باینری قبلی public با SHAهای Git مبنا تطبیق داشتند؛ هیچ تصویر/ویدئوی قبلی تغییر نکرد و هیچ فایل نامرتبط ریموت تغییر نداشت. workspace محلی تاریخچهٔ کپی‌شده دارد و snapshot محلی با delivery SHA ریموت متفاوت است؛ مرجع pull همان برنچ ریموت و commit گزارش‌شده در PR است.

## وضعیت مراحل تحویل

| فاز | وضعیت |
|---|---|
|۱–۶| کار قبلی حفظ؛ فقط وضعیت و اصلاح مرتبط نشست/گالری بررسی شد |
|۷–۸| PASS خودکار در Linux/PostgreSQL و Windows/Edge؛ بررسی بصری انجام شد |
|۹| مستندات، نسخه و Acceptance تکمیل |
|۱۰| Commit/Push روی feature branch؛ PR #4 باز و بدون merge/deploy |
|۱۱| دستورات دقیق و checklist بالا آماده؛ اجرای دستگاه/Acceptance مالک NOT RUN |
