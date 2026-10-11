# تصویر گروهی هوم‌پیج

تصویر دوم انتخاب‌شده کاربر، چهار پاکت وینستون روی زمینه سفید با هشدار «Fumer tue» است. فایل اصلی با ابعاد 1254×1254 از لوکال در commit `e1e696f` دریافت شد. عکس در زمینه روشن کل بخش ابتدایی قرار می‌گیرد؛ قاب مستقل، سایه قاب و زمینه تیره حذف شده‌اند. متن تیره در سمت راست و روی موبایل بالای عکس قرار می‌گیرد. تصویر برش یا بازطراحی نمی‌شود.

برای تعویض تصویر در آینده، PNG را در همین مسیر ذخیره کنید:

`D:\Smokeshop\frontend\public\images\hero\winston-collection.png`

نام و پسوند دقیق باشند؛ JPEG را با تغییر پسوند به PNG تبدیل نکنید. قاب کامل، حاشیه سفید و نوشته‌ها حفظ می‌شوند. سرور در هر درخواست هوم‌پیج وجود فایل را بررسی می‌کند؛ تا دریافت آن، عکس واقعی سیلور فروشنده نمایش داده می‌شود و تصویر خراب یا درخواست 404 ایجاد نمی‌شود.

پس از توقف اجرای توسعه با Ctrl+C، در PowerShell:

```powershell
Set-Location D:\Smokeshop
git switch main
git pull --ff-only origin main
git switch -c assets/homepage-photo
New-Item -ItemType Directory -Force frontend\public\images\hero | Out-Null
# اکنون عکس دوم را در مسیر بالا با نام winston-collection.png قرار دهید.
git add frontend/public/images/hero/winston-collection.png
git commit -m "assets: update Winston homepage collection photo"
git push -u origin HEAD
py -3.12 scripts/dev.py
```

به migration، seed یا تغییر محصول نیاز نیست. اگر سایت تولیدی دارید، فایل `public/images/hero/` همراه خروجی تولید منتشر و سرویس مجدداً راه‌اندازی شود. تست مرورگر بارگذاری عکس، نمایش کامل آن و حرکت اسکرول را بررسی می‌کند.

نسخه 0.7.0: حرکت عکس و خطوط محیطی فقط در hero، بدون دود/تاری ثابت کل صفحه. پس از تغییر دارایی PR به main باز کنید.
