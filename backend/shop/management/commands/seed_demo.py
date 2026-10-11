from django.core.management.base import BaseCommand
from django.db import transaction
from datetime import date
from shop.models import AuditLog, Category, FeatureFlag, Product
from shop.winston_catalog import CATEGORIES, WINSTON_CATALOG, DESCRIPTION, LEGACY_DESCRIPTION


class Command(BaseCommand):
    help = 'Prepare the Winston photo catalog, preserve seller edits and never enable online sales.'

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {}
        for slug, title in CATEGORIES.items():
            categories[slug], _ = Category.objects.get_or_create(slug=slug, defaults={'title': title})
        for number, suffix, slug, title, category, retail, wholesale in WINSTON_CATALOG:
            sku = f'DEMO-CIG-{suffix:03}'
            photo = f'/images/products/winston/optimized/{number}.webp'
            product, created = Product.objects.get_or_create(slug=slug, defaults={
                'title': title, 'sku': sku, 'category': categories[category],
                'product_type': 'cigarette', 'brand': 'Winston', 'illustration': 'pack',
                'retail_available': retail, 'wholesale_available': wholesale,
                'description': DESCRIPTION, 'catalog_image': photo,
                'stock': 0, 'legal_status': Product.LegalStatus.IN_PERSON_ONLY,
            })
            if not created and product.product_type == 'cigarette' and product.brand == 'Winston':
                # Attach the source photo without replacing any seller-uploaded image.
                changes = []
                if not product.catalog_image:
                    product.catalog_image = photo
                    changes.append('catalog_image')
                # Upgrade only untouched legacy demo metadata. Operational data stays intact.
                if (product.sku == sku and product.description == LEGACY_DESCRIPTION
                        and not AuditLog.objects.filter(entity=f'product:{product.pk}', action='ADMIN_UPDATE').exists()):
                    product.category = categories[category]
                    product.description = DESCRIPTION
                    changes.extend(['category', 'description', 'search_text'])
                    for field, legacy_value in [('sticks_per_pack', 20), ('packs_per_carton', 10)]:
                        if getattr(product, field) == legacy_value:
                            setattr(product, field, None)
                            changes.append(field)
                if changes:
                    product.save(update_fields=[*changes, 'updated_at'])
            if product.brand == 'Winston' and not product.source_url:
                product.manufacturer = product.manufacturer or 'JTI — گروه برند در بازار جهانی'
                product.source_url = 'https://www.jti.com/en/our-brands'
                product.source_checked_on = date(2026, 10, 11)
                product.specification_notes = product.specification_notes or 'منبع رسمی، ارتباط برند Winston با JTI را تأیید می‌کند؛ کشور تولید، تعداد واحد، نیکوتین و قطران این مدل از این منبع تأیید نمی‌شوند.'
                product.save(update_fields=['manufacturer', 'source_url', 'source_checked_on', 'specification_notes', 'updated_at'])
        for key, description in [('cart', 'سبد اقلام دارای مجوز'), ('order_requests', 'رزرو سفارش بدون پرداخت؛ نیازمند آماده‌سازی عملیات')]:
            FeatureFlag.objects.get_or_create(key=key, defaults={'description': description})
        self.stdout.write(self.style.SUCCESS('Winston photo catalog prepared; online sales remain disabled.'))
