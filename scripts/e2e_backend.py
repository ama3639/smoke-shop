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
    call_command('seed_roles', verbosity=0)
    category = Category.objects.create(title='آزمون خودکار', slug='e2e', online_enabled=True)
    product = Product.objects.create(title='کیف آزمون خرید', slug='e2e-approved', sku='E2E-ONLY',
                           category=category, description='فقط در دیتابیس موقت آزمون', material='پارچه',
                           stock=20, price=120000, legal_status='APPROVED_ONLINE', legal_reference='Isolated automated test fixture')
    for slug, title, price in [('e2e-one', 'فروشنده آزمون یک', 120000), ('e2e-two', 'فروشنده آزمون دو', 135000)]:
        vendor = Vendor.objects.create(title=title, slug=slug, active=True, city='محیط آزمون')
        Offer.objects.create(product=product, vendor=vendor, stock=20, price=price, approved=True)
    from django.contrib.auth.models import User, Group, Permission
    from shop.models import Cart, Order, OrderItem
    import uuid
    operator = User.objects.create_user('e2e-operator', password='test-only-operations', is_staff=True)
    operator.groups.add(Group.objects.get(name='Seller'))
    Vendor.objects.get(slug='e2e-one').members.add(operator)
    manager = User.objects.create_user('e2e-manager', password='test-only-management', is_staff=True)
    manager.groups.add(Group.objects.get(name='Marketplace manager'), Group.objects.get(name='Catalog editor'))
    User.objects.create_superuser('e2e-owner', password='test-only-owner')
    reader = User.objects.create_user('e2e-customer-reader', password='test-only-reader', is_staff=True)
    reader.user_permissions.add(Permission.objects.get(content_type__app_label='shop', codename='view_customer'))
    for project in ('desktop', 'mobile'):
        customer = User.objects.create_user(f'e2e-customer-{project}', email=f'{project}@example.test')
        order = Order.objects.create(cart=Cart.objects.create(user=customer, session_key=f'customer-{project}'),
            idempotency_key=uuid.uuid4(), total=120000, status='CANCELLED')
        OrderItem.objects.create(order=order, product=product, title=product.title, quantity=1, unit_price=120000)
        for retry in (0, 1):
            User.objects.create_user(f'supplier-{project}-{retry}', password='Supplier!Safe321')
            User.objects.create_user(f'supply-{project}-{retry}', password='Supply!Safe321')
    Product.objects.create(title='کالای ناموجود آزمون', slug='e2e-out-of-stock', sku='E2E-EMPTY', category=category,
        description='فقط در دیتابیس موقت آزمون', stock=0, price=0, active=False,
        legal_status='APPROVED_ONLINE', legal_reference='Isolated automated test fixture')
    tobacco = Category.objects.create(title='تنباکوی آزمون', slug='e2e-tobacco')
    for slug, flavor, weight in [('e2e-mint-small', 'نعناع', '50'), ('e2e-mint-large', 'نعناع', '250'), ('e2e-apple', 'سیب', '50')]:
        Product.objects.create(title=slug, slug=slug, sku=slug, category=tobacco, product_type='tobacco',
            brand='E2E Tobacco', flavor=flavor, weight_grams=weight, description='فقط در دیتابیس موقت آزمون', legal_status='CATALOG_ONLY')
    FeatureFlag.objects.update(is_enabled=True)
    call_command('runserver', '127.0.0.1:8010', use_reloader=False)


