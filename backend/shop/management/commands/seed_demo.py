from django.core.management.base import BaseCommand
from django.db import transaction
from shop.models import Category, FeatureFlag, Product


class Command(BaseCommand):
    help = 'Create catalog-only sample data; never overwrite existing products or enable sales.'

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {}
        for slug, title in [('regular', 'استاندارد'), ('slim', 'اسلیم'), ('compact', 'کامپکت')]:
            categories[slug], _ = Category.objects.get_or_create(slug=slug, defaults={'title': title})
        samples = [
            ('winston-red', 'وینستون قرمز', 'regular', 'Winston', True, True),
            ('winston-blue', 'وینستون آبی', 'regular', 'Winston', True, True),
            ('winston-xs-blue', 'وینستون XS آبی', 'slim', 'Winston', True, True),
            ('winston-xs-silver', 'وینستون XS سیلور', 'slim', 'Winston', True, False),
            ('winston-compact-blue', 'وینستون کامپکت آبی', 'compact', 'Winston', True, True),
            ('winston-compact-silver', 'وینستون کامپکت سیلور', 'compact', 'Winston', False, True),
        ]
        for index, (slug, title, category, brand, retail, wholesale) in enumerate(samples):
            product, _ = Product.objects.get_or_create(slug=slug, defaults={
                'title': title, 'sku': f'DEMO-CIG-{index + 1:03}', 'category': categories[category],
                'product_type': 'cigarette', 'brand': brand, 'illustration': 'pack',
                'retail_available': retail, 'wholesale_available': wholesale,
                'description': 'مدل و برند نمایشی برای بررسی رابط فروشگاه؛ این اطلاعات، موجودی یا تأیید عرضه واقعی نیست. مشخصات باید با داده واقعی فروشنده جایگزین شوند.',
                'stock': 0, 'legal_status': Product.LegalStatus.IN_PERSON_ONLY,
            })
        for key, description in [('cart', 'سبد اقلام دارای مجوز'), ('order_requests', 'رزرو سفارش بدون پرداخت؛ نیازمند آماده‌سازی عملیات')]:
            FeatureFlag.objects.get_or_create(key=key, defaults={'description': description})
        self.stdout.write(self.style.SUCCESS('Sample catalog prepared; sales remain disabled.'))
