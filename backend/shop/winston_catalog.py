"""Names transcribed from the fourteen seller-supplied packet images.

Keep the original seven demo identifiers stable. No price or stock is inferred.
"""

CATEGORIES = {
    'regular': 'کلاسیک', 'xs': 'XS', 'nova': 'نوا',
    'superslim': 'سوپراسلیم', 'x-style': 'ایکس استایل', 'compact': 'کامپکت',
}

# Image number, existing/new internal SKU suffix, slug, title, family, catalog modes.
WINSTON_CATALOG = [
    ('01', 8, 'winston-superslim-silver', 'وینستون سوپراسلیم سیلور', 'superslim', True, True),
    ('02', 4, 'winston-xs-silver', 'وینستون XS سیلور', 'xs', True, False),
    ('03', 9, 'winston-nova-silver', 'وینستون نوا سیلور', 'nova', True, True),
    ('04', 3, 'winston-xs-blue', 'وینستون XS آبی', 'xs', True, True),
    ('05', 10, 'winston-x-style-silver', 'وینستون ایکس استایل سیلور', 'x-style', True, True),
    ('06', 2, 'winston-blue', 'وینستون آبی', 'regular', True, True),
    ('07', 1, 'winston-red', 'وینستون قرمز', 'regular', True, True),
    ('08', 11, 'winston-superslim-blue', 'وینستون سوپراسلیم آبی', 'superslim', True, True),
    ('09', 12, 'winston-nova-blue', 'وینستون نوا آبی', 'nova', True, True),
    ('10', 5, 'winston-compact-blue', 'وینستون کامپکت آبی', 'compact', True, True),
    ('11', 6, 'winston-compact-silver', 'وینستون کامپکت سیلور', 'compact', False, True),
    ('12', 7, 'winston-silver', 'وینستون سیلور', 'regular', True, True),
    ('13', 13, 'winston-xs-black', 'وینستون XS مشکی', 'xs', True, True),
    ('14', 14, 'winston-x-style-blue', 'وینستون ایکس استایل آبی', 'x-style', True, True),
]

LEGACY_DESCRIPTION = 'مدل و برند نمایشی برای بررسی رابط فروشگاه؛ این اطلاعات، موجودی یا تأیید عرضه واقعی نیست. مشخصات باید با داده واقعی فروشنده جایگزین شوند.'
DESCRIPTION = 'نام مدل و تصویر بسته بر اساس فایل ارسالی فروشنده ثبت شده است. موجودی، تعداد نخ در بسته و تعداد بسته در باکس، پس از تأیید فروشنده تکمیل می‌شوند.'
