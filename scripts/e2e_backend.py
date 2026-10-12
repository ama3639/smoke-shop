"""Isolated browser-test database; never enable sales in the development DB."""
import os
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
os.environ.pop('DATABASE_URL', None)
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
os.environ['DJANGO_DEBUG'] = '1'
os.environ['DJANGO_CSRF_TRUSTED_ORIGINS'] = 'http://127.0.0.1:3010'

with tempfile.TemporaryDirectory(prefix='smoke-e2e-') as directory:
    os.environ['SQLITE_PATH'] = str(Path(directory) / 'db.sqlite3')
    import django
    django.setup()
    from django.core.management import call_command
    from shop.models import Category, FeatureFlag, Offer, Product, Vendor
    call_command('migrate', interactive=False, verbosity=0)
    call_command('seed_demo', verbosity=0)
    category = Category.objects.create(title='آزمون خودکار', slug='e2e', online_enabled=True)
    product = Product.objects.create(title='کیف آزمون خرید', slug='e2e-approved', sku='E2E-ONLY',
                           category=category, description='فقط در دیتابیس موقت آزمون', material='پارچه',
                           stock=20, price=120000, legal_status='APPROVED_ONLINE', legal_reference='Isolated automated test fixture')
    for slug, title, price in [('e2e-one', 'فروشنده آزمون یک', 120000), ('e2e-two', 'فروشنده آزمون دو', 135000)]:
        vendor = Vendor.objects.create(title=title, slug=slug, active=True, city='محیط آزمون')
        Offer.objects.create(product=product, vendor=vendor, stock=20, price=price, approved=True)
    tobacco = Category.objects.create(title='تنباکوی آزمون', slug='e2e-tobacco')
    for slug, flavor, weight in [('e2e-mint-small', 'نعناع', '50'), ('e2e-mint-large', 'نعناع', '250'), ('e2e-apple', 'سیب', '50')]:
        Product.objects.create(title=slug, slug=slug, sku=slug, category=tobacco, product_type='tobacco',
            brand='E2E Tobacco', flavor=flavor, weight_grams=weight, description='فقط در دیتابیس موقت آزمون', legal_status='CATALOG_ONLY')
    FeatureFlag.objects.update(is_enabled=True)
    call_command('runserver', '127.0.0.1:8010', use_reloader=False)

