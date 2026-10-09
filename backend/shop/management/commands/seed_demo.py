from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction
from shop.models import Category, CompatibilityRule, Device, FeatureFlag, Product


class Command(BaseCommand):
    help = 'Create catalog-only sample data; never overwrite existing products or enable sales.'

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {}
        for slug, title in [('care', 'نظافت و نگهداری'), ('storage', 'کیف و نگهدارنده'), ('parts', 'قطعات و اتصالات')]:
            categories[slug], _ = Category.objects.get_or_create(slug=slug, defaults={'title': title})
        device, _ = Device.objects.get_or_create(slug='sample-9mm', defaults={'title': 'مدل نمونه با اتصال ۹ میلی‌متر'})
        samples = [
            ('travel-case', 'کیف نگهداری ابزار', 'storage', 'case', 'پارچه و چرم مصنوعی', '۱۸ × ۱۰ سانتی‌متر'),
            ('cleaning-brush', 'برس نظافت قطعات', 'care', 'brush', 'الیاف نرم و استیل', 'طول ۱۵ سانتی‌متر'),
            ('desk-stand', 'پایه نگهدارنده رومیزی', 'storage', 'stand', 'چوب', '۱۲ × ۸ سانتی‌متر'),
            ('seal-ring', 'واشر اتصال ۹ میلی‌متر', 'parts', 'ring', 'سیلیکون', 'قطر داخلی ۹ میلی‌متر'),
            ('care-kit', 'کیف مجموعه ابزار نگهداری', 'care', 'case', 'پارچه', '۲۰ × ۱۲ سانتی‌متر'),
            ('soft-brush', 'پاک‌کن انعطاف‌پذیر', 'care', 'brush', 'الیاف پنبه', 'طول ۱۶ سانتی‌متر'),
        ]
        for index, (slug, title, category, illustration, material, dimensions) in enumerate(samples):
            product, _ = Product.objects.get_or_create(slug=slug, defaults={
                'title': title, 'sku': f'DEMO-{index + 1:03}', 'category': categories[category],
                'illustration': illustration, 'material': material, 'dimensions': dimensions,
                'description': 'این داده برای نمایش ساختار کاتالوگ است. مشخصات، تصویر و موجودی پیش از عرضه باید با کالای واقعی جایگزین شوند.',
                'stock': 0, 'legal_status': Product.LegalStatus.CATALOG_ONLY,
            })
            if slug == 'seal-ring':
                CompatibilityRule.objects.get_or_create(device=device, product=product, defaults={
                    'evidence_source': 'رابطه نمایشی؛ نیازمند تأیید با کالای واقعی',
                    'confidence': 'EXPERIMENTAL', 'last_verified': date(2026, 10, 9),
                })
        for key, description in [('cart', 'سبد اقلام دارای مجوز'), ('order_requests', 'رزرو سفارش بدون پرداخت؛ نیازمند آماده‌سازی عملیات')]:
            FeatureFlag.objects.get_or_create(key=key, defaults={'description': description})
        self.stdout.write(self.style.SUCCESS('Sample catalog prepared; sales remain disabled.'))
