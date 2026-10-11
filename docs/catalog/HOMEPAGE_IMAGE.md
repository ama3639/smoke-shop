# تصویر گروهی هوم‌پیج

تصویر دوم انتخاب‌شده کاربر، چهار پاکت وینستون روی زمینه سفید با هشدار «Fumer tue» است. پیش‌نمایش گفتگو در دسترس است، اما فایل اصلی هنوز وارد مخزن نشده است. تصویر بازطراحی یا از وب جایگزین نمی‌شود.

فایل PNG واقعی را با نام زیر ذخیره کنید:

`D:\Smokeshop\frontend\public\images\hero\winston-collection.png`

نام و پسوند دقیق باشند؛ JPEG را با تغییر پسوند به PNG تبدیل نکنید. قاب کامل، حاشیه سفید و نوشته‌ها حفظ می‌شوند. سرور در هر درخواست هوم‌پیج وجود فایل را بررسی می‌کند؛ تا دریافت آن، عکس واقعی سیلور فروشنده نمایش داده می‌شود و تصویر خراب یا درخواست 404 ایجاد نمی‌شود.

پس از توقف اجرای توسعه با Ctrl+C، در PowerShell:

```powershell
Set-Location D:\Smokeshop
git pull --ff-only origin main
New-Item -ItemType Directory -Force frontend\public\images\hero | Out-Null
# اکنون عکس دوم را در مسیر بالا با نام winston-collection.png قرار دهید.
git add frontend/public/images/hero/winston-collection.png
git commit -m "assets: add Winston homepage collection photo"
git push origin HEAD:main
py -3.12 scripts/dev.py
```

به migration، seed یا تغییر محصول نیاز نیست. اگر سایت تولیدی دارید، فایل `public/images/hero/` همراه خروجی تولید منتشر و سرویس مجدداً راه‌اندازی شود. تست مرورگر بارگذاری عکس، نمایش کامل آن و حرکت اسکرول را بررسی می‌کند.
