# قرارداد API کاتالوگ و چندفروشندگی

نسخه: 0.8.0 · تاریخ: 2026-10-11

پایه `/api/v1/`؛ موفقیت `{success:true,data:...}` و خطا `{success:false,error:{code,message}}`. مسیرهای تغییردهنده نشست مهمان و CSRF دارند؛ فرانت‌اند از proxy هم‌دامنه استفاده می‌کند.

| مسیر | قرارداد |
|---|---|
| GET catalog/ | facets همه کالاهای عمومی: categories, brands, types, vendors, total, updated_at, devices, checkout_enabled؛ type اختیاری |
| GET catalog/products/ | فیلتر type, q, category, brand, vendor(slug), mode(retail/wholesale), available=1؛ page≥1، page_size=1..100 |
| GET catalog/products/?pagination=1 | data شامل items,total,page,page_size,pages,has_next؛ UI اندازه ۲۴ |
| GET catalog/products/ بدون pagination | data آرایه مانند نسخه قبل؛ meta صفحه‌بندی در سطح پاسخ؛ پیش‌فرض ۱۰۰ ردیف |
| GET catalog/products/:slug/ | کالای عمومی، offers تأییدشده/فعال، مشخصات و منبع؛ پنهان/مسدود =>404 |
| GET vendors/ | فروشندگان فعال با تماس عمومی؛ اعضا و دسترسی‌ها برگردانده نمی‌شوند |
| POST cart/ | product_id, quantity=1..20 و برای کالاهای دارای عرضه offer_id؛ انتخاب عرضه همان کالا الزامی |
| DELETE cart/ | item_id برای حذف ردیف همان سبد؛ product_id قدیمی همچنان تمام ردیف‌های همان محصول را حذف می‌کند |
| GET cart/ | ردیف id,offer_id,seller_name,product,quantity؛ قیمت/موجودی انتخاب همان عرضه |
| POST orders/ | idempotency_key از نوع UUID؛ درخواست رزرو بدون پرداخت، فقط برای نشست بزرگسال و کالاهای مجاز |
| GET orders/:id/ | فقط نشست مالک؛ expires_at و items با seller_name و قیمت snapshot |

کالاهای غیرفعال، REVIEW_REQUIRED و BLOCKED از کاتالوگ/facets حذف‌اند. عرضه پنهان هرگز به مجموع موجودی/قیمت عمومی اضافه نمی‌شود. داشتن عرضه، موجودی مستقیم Product را از محاسبه خارج می‌کند؛ fallback به عرضه مستقیم فقط برای کالای بدون هیچ Offer است.

صفحه خارج از آخرین صفحه آرایه خالی با همان metadata برمی‌گرداند؛ اندازه/صفحه نامعتبر INVALID_PAGE=400 است. ترتیب پایدار ID است؛ فیلتر cigarette برای حفظ ترتیب عکس‌های قدیمی catalog_image سپس ID است.

خطاهای جدید مهم: SELLER_REQUIRED=409، OFFER_CHANGED=409، INVALID_OFFER=400؛ وضعیت خرید دخانیات در سرور رد می‌شود، حتی اگر UI یا داده مستقیم دستکاری شود. فیلتر available و mode باید به همان عرضه واجد شرایط مربوط باشند.

مهلت رزرو به معنی اجرای خودکار worker نیست؛ expire_orders زمان‌بندی لازم دارد. API جدید مدیریت عمومی یا پرداخت اضافه نشده؛ مدیریت از Django Admin انجام می‌شود.

مسیر رابط 0.8.0: / هوم‌پیج با فهرست سیگار و ورودی چهار دسته؛ /catalog همه انواع؛ /catalog?type=accessory اکسسوری؛ /catalog?vendor=slug کالاهای فروشنده. لینک مستقیم type/vendor/mode/q/category/brand در دریافت اولیه و state فیلتر اعمال می‌شود. category=vape-pod و category=pipe مطابق slug دستهٔ ثبت‌شده‌اند؛ بدون داده نتیجه خالی دارند. API عمومی و داده‌ها تغییری ندارند.
