# بررسی تازهٔ اصلاحات — 2026-10-26

این قسمت جایگزین وضعیت فعلی وابستگی‌ها در گزارش تاریخی زیر است؛ ممیزی جامع یا تأیید تولید نیست.

- Audit تازه روی Next 16.4.0 یک وابستگی Critical گزارش کرد: GHSA-2464-fhr4-w9xw و GHSA-673q-mjm6-r5xr (RCE)، همراه GHSA-p3m5-59mp-jv5r (DoS). نبودن مسیر exploit در این بررسی اثبات نشده و کد exploit اجرا نشده است.
- Next و eslint-config-next هر دو به patch سازگار 16.4.3 و lockfile واقعی npm ارتقا یافتند؛ force، override، downgrade یا حذف lint انجام نشد.
- npm audit --omit=dev --json و npm audit --json پس از نصب: صفر finding، هر دو exit 0 در زمان بررسی. Advisory تاریخی braces دیگر در گراف فعلی نصب گزارش نمی‌شود؛ این نتیجه اثبات امنیت کل برنامه نیست.
- typecheck، lint، سه unit و build تولید با 16.4.3 موفق بودند. گزارش تست نقش‌ها و اجرای مرورگر در سند اجرای پروژه ثبت می‌شود.
- عملیات قیمت/موجودی پشت session، staff و permission فعلی، CSRF و scope فروشنده است؛ preview امضاشده به حساب متصل و ۱۰ دقیقه معتبر است. نسخهٔ عرضه بعد از قفل ردیف کنترل می‌شود تا تغییر هم‌زمان موجودی/قیمت بازنویسی نشود. عملیات و پاسخ خطا no-store هستند.
- CSP فعلی فقط base-uri/object-src/form-action/frame-ancestors را محدود می‌کند و سیاست script/style کامل نیست. 2FA، cache/rate-limit مشترک و پیکربندی تولید هنوز تأیید/پیاده‌سازی کامل نشده‌اند.

منابع رسمی: [Image Optimization](https://github.com/advisories/GHSA-2464-fhr4-w9xw)، [Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r)، [use cache](https://github.com/advisories/GHSA-673q-mjm6-r5xr).

---

## گزارش تاریخی 2026-10-12

# Security Notes — 0.10.1

تاریخ بررسی: 2026-10-12. دامنه: هشدار npm گزارش‌شده توسط مالک، نه ممیزی جامع امنیتی یا مجوز Production. نسخه storefront و سیاست خرید/حساب/داده تغییر نکرده است.

## نتیجه واقعی

| بررسی | نتیجه |
|---|---|
| `npm audit --json` | exit 1؛ پنج High، یک Advisory مستقل |
| `npm audit --omit=dev --json` | exit 0؛ صفر Advisory گزارش‌شده در وابستگی تولید |
| نسخه نصب‌شده و آخرین نسخه registry | braces 3.0.3؛ eslint-config-next و @next/eslint-plugin-next 16.4.0 |
| اصلاح سازگار منتشرشده | BLOCKED؛ Advisory نسخه patched ندارد |
| اصلاح اعمال‌شده به وابستگی‌ها | هیچ؛ resolution/integrity و peer contract حفظ‌اند |
| CI | Audit تولید با `--audit-level=high` به هر دو Job افزوده شد؛ هیچ تستی حذف/تضعیف نشد |

## Advisory و مسیر وابستگی

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) / CVE-2026-93687: recursive AST walkers در braces تا 3.0.3 هنگام الگوی بسیار تو‌در‌تو می‌توانند stack را تمام کنند و RangeError بدهند. منبع رسمی در زمان بررسی patched version را None اعلام می‌کند. پنج مورد npm پنج رخنه مستقل نیستند؛ اثر همان Advisory به والدها منتشر شده است:

```text
eslint-config-next@16.4.0 (dev)
  @next/eslint-plugin-next@16.4.0
    fast-glob@3.3.1
      micromatch@4.0.8
        braces@3.0.3
```

همه پنج entry در Lockfile `dev: true` دارند. sink کتابخانه `frontend/node_modules/braces/lib/compile.js` و `lib/expand.js` است. caller افزونه Next در `dist/utils/get-root-dirs.js`، `fast-glob.globSync` را فقط برای `context.settings.next.rootDir` رشته/آرایه فراخوانی می‌کند. تنها caller داخلی آن rule `no-html-link-for-pages` است. config فعلی `frontend/eslint.config.mjs` چنین rootDir ندارد و مسیر پیش‌فرض `[context.cwd]` را استفاده می‌کند؛ این rule همچنان فعال است.

در کد فروشگاه caller مستقیم braces/micromatch/fast-glob وجود ندارد. الگوی تنظیمات ESLint ورودی HTTP مشتری نیست. این بررسی، مسیر دسترسی از Search/Cart/API به این sink را پیدا نکرد؛ نبود مسیر فعلی و Audit تولید صفر، اثبات امنیت کامل runtime یا مجوز اجرای پروژه/ESLint config غیرقابل‌اعتماد نیست. نصب کامل dev dependencies همچنان نسخه آسیب‌پذیر را روی ماشین توسعه/CI نگه می‌دارد. خطر DoS ابزار توسعه باقی است؛ آن را fixed اعلام نمی‌کنیم. بازتولید exploit در این مرحله اجرا نشده؛ مبنا Advisory رسمی، Audit واقعی و تحلیل caller است.

## چرا force، override و Downgrade اعمال نشد

پیشنهاد npm نصب `eslint-config-next@14.2.35` با `audit fix --force` است؛ major آن با Next 16.4 و flat-config فعلی هم‌نسخه نیست. braces نسخه patch منتشرشده ندارد؛ override همان نسخه رفع نیست. حذف lint rules، جایگزین ساختگی کتابخانه، patch دستی node_modules یا کاهش پوشش برای صفرکردن Audit معتبر نیست.

## برنامه اصلاح و کنترل باقی‌مانده

1. در هر تغییر وابستگی، full Audit و Production Audit هر دو اجرا و خروجی با این baseline مقایسه شود؛ پنج High را پنهان یا صفر گزارش نکنید. گیت CI فعلی فقط Production Audit است؛ استثنای موقت ابزار توسعه به معنی رفع Advisory نیست.
2. rootDir/glob تنظیمات lint از ورودی کاربران یا مخزن غیرقابل‌اعتماد ساخته نشود. اجرای کد/config مخزن غیرقابل‌اعتماد خارج از مرز اعتماد این بررسی است. این بند توصیه عملیاتی است، نه sandbox جدید پیاده‌شده.
3. پس از انتشار patch رسمی braces در major سازگار، فقط مسیر transitive لازم با Lockfile به‌روز شود؛ یا نسخه سازگار Next ESLint که این dependency را حذف/اصلاح کند بررسی شود. runtime و lint major باید سازگار بمانند.
4. پیش از پذیرش اصلاح آینده: full Audit، Production Audit، `npm ls`، lint، typecheck، unit، build و همه ۵۶ E2E روی Linux/Windows؛ اگر همچنان Advisory باقی است، رفع‌شده اعلام نشود.
5. برای runtime آینده وابستگی‌های dev در محیط مجزا نگه داشته شوند؛ بسته production بدون dev باید جدا در محیط staging اعتبارسنجی شود. این کار هنوز Deployment یا آزمون بسته‌بندی production انجام نداده است.

## فرمان‌های مستقل Windows

```powershell
Set-Location D:\Smokeshop
```

```powershell
npm --prefix frontend audit --json
```

```powershell
npm --prefix frontend audit --omit=dev --json
```

```powershell
npm --prefix frontend ls braces micromatch fast-glob @next/eslint-plugin-next eslint-config-next
```

full Audit با این baseline عمداً exit 1 دارد؛ این FAIL شناخته‌شده را از Lint/E2E و Audit تولید جدا ثبت کنید. وضعیت CI هر SHA و محدودیت لوکال/Acceptance در PR #4 و [راهنمای تحویل](deployment/PREMIUM_STOREFRONT.md) ثبت می‌شود.
