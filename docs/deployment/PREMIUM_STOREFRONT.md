# بازطراحی فروشگاه — نسخه 0.9.0

تاریخ: 2026-10-11 UTC / 1405-07-20 تهران. مبنا ama3639/smoke-shop، feature/premium-storefront، SHA 2c02171ab0f2c783d637a08b143acd796efa9fd7؛ ادامه در feature/editorial-hookah-tobacco. PR به برنچ قبلی است؛ main و PR #2 تغییر ندارند، تولید مستقر نشده است.

## قبل و بعد

| بخش | قبل 0.8.0 | بعد 0.9.0 |
|---|---|---|
| معرفی اصلی | عنوان سه‌خطی و تصویر گروهی | عنوان کوتاه‌تر، تصویر کامل و عنوان کالکشن، فضای بیشتر روی دسکتاپ/موبایل |
| ورود دسته | سیگار/ویپ/پیپ/اکسسوری | افزودهٔ قلیان و تنباکو، مجموع شش ورودی |
| قلیان | ورودی مستقل ندارد | category=hookah، معرفی مستقل و مسیر اکسسوری؛ بدون داده حالت خالی |
| تنباکو | برند/دسته عمومی | افزودهٔ طعم و وزن حقیقی، ترکیب فیلترها و حذف تک‌فیلتر |
| ادمین/DB | طعم/وزن ندارد | فیلد اختیاری flavor و weight_grams؛ migration0006 افزایشی |
| رفتار حفظ‌شده | تصاویر Winston، دود، API، رزرو | عکس کامل، توقف/reduced-motion، API قدیمی و سیاست خرید سرور حفظ‌اند |

جهت طراحی: Davidoff / El Badia / Hookah.com؛ اجرای مستقل بدون دریافت کد یا تصاویر مراجع. محصول و آمار/تخفیف فرضی ساخته نشده است. تصاویر و فیلم‌های موجود با هش Git تطبیق یافته‌اند. فهرست هوم‌پیج فقط سیگار است؛ سایر اقلام در کاتالوگ مستقل باقی می‌مانند.

## دریافت و ارتقای نصب موجود — PowerShell

ابتدا سرور توسعه را با Ctrl+C متوقف کنید. اگر git status تغییر محلی نشان داد، آن را حفظ کنید و قبل از switch بررسی کنید؛ دستور reset/clean/stash خودکار اجرا نکنید.

```powershell
Set-Location D:\Smokeshop
git status --short
git fetch origin
git switch feature/editorial-hookah-tobacco
git pull --ff-only origin feature/editorial-hookah-tobacco
git log -1 --oneline
```

اگر SQLite پیش‌فرض توسعه دارید، قبل از migrate یک backup بگیرید:

```powershell
if (Test-Path .\backend\db.sqlite3) {
    $smokeBackup = ".\backend\db-before-0.9.0-$(Get-Date -Format yyyyMMdd-HHmmss).sqlite3"
    Copy-Item .\backend\db.sqlite3 $smokeBackup
}
.\backend\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
npm --prefix frontend ci
.\backend\.venv\Scripts\python.exe backend\manage.py migrate
.\backend\.venv\Scripts\python.exe backend\manage.py check
py -3.12 scripts/dev.py
```

اگر DATABASE_URL دارید، این backup فایل مربوط به دیتابیس PostgreSQL نیست؛ از روش backup PostgreSQL محیط خود استفاده کنید. عکس‌های آپلودشده backend/media در این تغییر دست‌کاری نمی‌شوند.

## نصب تازه

Python3.12+ و Node22+ مطابق پروژه نصب باشند:

```powershell
Set-Location D:\Smokeshop
py -3.12 scripts/setup.py
.\backend\.venv\Scripts\python.exe backend\manage.py createsuperuser
py -3.12 scripts/dev.py
```

setup فقط برای نصب تازه؛ برای ارتقای نصب موجود از دستورهای بخش قبل استفاده کنید.

## اجرای تست

```powershell
Set-Location D:\Smokeshop
.\backend\.venv\Scripts\python.exe backend\manage.py check
.\backend\.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
.\backend\.venv\Scripts\python.exe backend\manage.py test shop
Set-Location .\frontend
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E از دیتابیس SQLite موقت و پورت‌های8010/3010 استفاده می‌کند و DB توسعه را تغییر نمی‌دهد. پنج آزمون قفل/همزمانی در SQLite skip می‌شوند؛ اجرای بدون skip به PostgreSQL و CI نیاز دارد.

## مسیرهای بررسی دستی

- فروشگاه: http://localhost:3000
- قلیان: http://localhost:3000/catalog?category=hookah
- اکسسوری: http://localhost:3000/catalog?type=accessory
- تنباکو: http://localhost:3000/catalog?type=tobacco
- ادمین: http://localhost:8000/admin/

در ادمین، Category قلیان را با slug=hookah و محصولات واقعی ثبت کنید؛ برای تنباکو product_type=tobacco، دسته واقعی، برند و طعم/وزن مستند ثبت شوند. ثبت‌نشدن داده یعنی نتیجهٔ خالی، نه خرابی صفحه. نمونه‌های نعناع/سیب و وزن50/250 فقط fixture دیتابیس آزمون‌اند.

در 320px، موبایل و دسکتاپ: نبود اسکرول افقی، کامل‌بودن عکس‌ها، اجرای/توقف دود و reduced-motion، شش ورودی، فیلترهای برند/دسته/طعم/وزن، حالت خالی و برگشت به اکسسوری را بررسی کنید.

## اعتبارسنجی

- محلی Linux، Python3.12.14 / Node24.19.0: check و migration check موفق؛ 51 آزمون backend، 46 موفق و 5 skip در SQLite؛ typecheck و build موفق.
- دانلود Chromium استاندارد در محیط محلی مسدود/خراب است؛ تست مرورگر محلی هنوز تأیید نشده. نتیجهٔ CI واقعی و تصاویر مرورگر در PR ثبت خواهد شد.
- Windows مالک و production هنوز اجرا نشده‌اند.

## برگشت توسعه

در صورت مشکل رابط، پس از حفظ تغییرات محلی به feature/premium-storefront برگردید، npm ci و dev را اجرا کنید. دو ستون جدید با نسخهٔ قبلی سازگارند و لازم نیست migration را معکوس یا دیتابیس را بازنشانی کنید.
