# Design System — E / Titanium Silver

نسخه0.10.0 · 2026-10-12. مرجع نهایی تصویر تأییدشده مالک: `frontend/public/images/titanium-reference.png`،765×960. ظاهر مدرن، مینیمال، دقیق، صنعتی با سطح گرافیتی و accent نقره‌ای. فایل اجرایی tokens/components: `frontend/app/globals.css`.

## Tokens

| Token | مقدار | نقش |
|---|---|---|
| background-primary | #0f1419 | زمینه اصلی |
| background-secondary | #161d24 | Header/Footer، فرم، حالت خالی |
| surface-card | #202a34 | کارت، input، پنل |
| surface-elevated | #263240 | hover/سطح بالاتر |
| border-default / border-soft | #3c4a58 / #556170 | تفکیک و قاب |
| accent-primary / accent-hover | #c6cdd6 / #e3e7ec | نقره‌ای / focus |
| text-primary / text-secondary | #f2f4f7 / #b6c0ca | متن/توضیح |
| radius / space | 8px / 8px | مبنای قاب/فاصله |
| ease | cubic-bezier(.2,.7,.2,1) | حرکت کنترل‌شده |

نام‌های legacy ink/muted/ivory/paper/copper/line فقط alias همین tokens هستند؛ پالت جدا نیستند. فونت محلی Vazirmatn، متن پایه14px/1.9 و عناوین clamp؛ برند/نسخه انگلیسی Arial با dir=ltr. قیمت و تعداد با Intl.NumberFormat fa-IR و واحد ثبت‌شده.

## ساختار و کامپوننت‌ها

Header مشترک با navigation واقعی، Search و آیکون حساب/علاقه‌مندی/سبد. Hero متن زنده سمت چپ و تصویر نمایشی سمت راست در Desktop؛ در Mobile متن سپس تصویر. ردیف خدمات فقط لینک/اطلاعات موجود؛ ادعای ارسال/اصالت/پشتیبانی بدون داده ندارد. شش کارت دسته مطابق ترتيب مرجع از راست سیگار، ویپ/پاد، پیپ، قلیان، تنباکو و اکسسوری. منتخب حداکثر شش سیگار واقعی؛ کالاهای دیگر در catalog. چهار پنل معرفی و Footer لینک واقعی دارند.

ProductCard عکس واقعی با contain و وضعیت واقعی SKU دارد؛ قلب خارج از لینک محصول است. محدودیت قانونی Add-to-cart را پنهان/غیرفعال می‌کند. تصویر ماکاپ جایگزین عکس کالای نامعلوم نیست. ProductGallery فقط عکس ثبت‌شده را باز می‌کند؛ نمای اضافه/جعبه باز ساختگی ندارد. Dialog بومی، focus/بستن Escape و اندازه محدود viewport.

Storefront مشترک برای catalog/category/brand/search؛ فیلتر و صفحه‌بندی واقعی و empty/error/loading. CartView مشترک cart/checkout؛ مبلغ/موجودی سرور و ثبت درخواست رزرو بدون پرداخت. AccountView مشترک login/register/account؛ password autocomplete درست، labels و پیام‌های status/alert. Wishlist فقط مرورگر؛ header count پس از تعامل به‌روز. شعب/فروشنده/راهنما/سیاست/404 همان سطوح، Typography و Footer را دارند.

## Responsive، RTL و Accessibility

Container حداکثر1440px؛ حاشیه Desktop32px، Mobile16px. Breakpoints1100/740. دسته‌ها6→3→2 ستون، محصول‌ها4→3→2 و منتخب6→3→2؛ جزئیات/سبد/حساب در Mobile یک ستون. منوی موبایل scroll افقی داخلی دارد؛ کل صفحه نباید اسکرول افقی بگیرد. عنوان‌ها/فیلترها/کلمات بلند wrap؛ timestamp/UUID/brand direction مستقل.

HTML lang=fa و dir=rtl؛ semantic header/nav/main/footer، یک h1 برای هر مسیر، labels، skip-link و outline focus. کنترل‌های مهم input/button و قلب/آیکون44px. تأیید۱۸+ dialog واقعی است و Escape آن را دور نمی‌زند. گالری فقط هنگام بازشدن focus را محصور می‌کند. متن secondary و primary از tokens با کنتراست خوانا؛ آزمون خودکار overflow/semantics جایگزین ممیزی جامع WCAG نیست.

## Motion و دارایی

فیلم‌های homepage-smoke.mp4/webm همان دارایی‌های قبلی‌اند، داخل Hero بدون لایه ثابت یا تاری محتوا. توقف دستی، offscreen و hidden-tab؛ در prefers-reduced-motion ویدئو اصلاً mount/request نمی‌شود. Static Hero با تصویر موجود باقی می‌ماند. تصاویر PNG اصلی و WebP محصولات حفظ شده‌اند. ماکاپ یک منبع نمایشی مشترک است تا بین بخش‌ها شکل یکسان بماند؛ رزولوشن منبع سقف کیفیت معرفی است، عکسSKU جداست.

## بررسی و Acceptance

E2E:23مسیر در عرض320/390/768/1440، RTL، یکh1، سطح مشترک، overflow، خطای JS و screenshot. تست مستقل دود، reduced-motion، keyboard، gallery، account، cart/checkout، filters و favorites. نتیجه و check-list مالک در [PREMIUM_STOREFRONT](../deployment/PREMIUM_STOREFRONT.md). انطباق بصری نهایی و پذیرش کسب‌وکار فقط پس از تست دستی مالک؛ CI تأیید نهایی طراحی نیست.
