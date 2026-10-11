import io
import uuid
from datetime import date
from django.contrib.auth.models import Permission, User
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import Client, TestCase
from django.test import TransactionTestCase
from django.db import connection, connections
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from .models import AuditLog, Branch, Cart, CartItem, Category, CompatibilityRule, Device, FeatureFlag, Order, Product, StockLedger
from .services import ShopError, checkout


class ShopTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(title='ابزار', slug='tools', online_enabled=True)
        self.product = Product.objects.create(title='کیف کوچک', slug='case', sku='CASE-1', category=self.category,
                                             description='کیف', stock=5, price=100000,
                                             legal_status='APPROVED_ONLINE', legal_reference='test-only approval')
        FeatureFlag.objects.create(key='cart', is_enabled=True)
        FeatureFlag.objects.create(key='order_requests', is_enabled=True)
        self.client.post('/api/v1/session/', {'adult': True}, content_type='application/json')

    def add(self, product=None, quantity=1, client=None):
        return (client or self.client).post('/api/v1/cart/', {'product_id': (product or self.product).pk, 'quantity': quantity}, content_type='application/json')

    def order(self, client=None, key=None):
        return (client or self.client).post('/api/v1/orders/', {'idempotency_key': str(key or uuid.uuid4())}, content_type='application/json')

    def test_default_status_is_review(self):
        p = Product.objects.create(title='Pending', slug='pending', sku='NEW', category=self.category)
        self.assertEqual(p.legal_status, 'REVIEW_REQUIRED')
        self.assertEqual(self.client.get('/api/v1/catalog/products/pending/').status_code, 404)

    def test_restricted_statuses_rejected_in_api(self):
        for status in ['CATALOG_ONLY', 'IN_PERSON_ONLY', 'REVIEW_REQUIRED', 'BLOCKED']:
            self.product.legal_status = status
            self.product.save()
            self.assertEqual(self.add().status_code, 403, status)
        self.assertFalse(CartItem.objects.exists())

    def test_hidden_products_and_catalog_price(self):
        self.product.legal_status = 'CATALOG_ONLY'
        self.product.save()
        data = self.client.get('/api/v1/catalog/products/').json()['data']
        self.assertIsNone(data[0]['price'])
        self.product.legal_status = 'BLOCKED'
        self.product.save()
        self.assertEqual(self.client.get('/api/v1/catalog/products/').json()['data'], [])

    def test_legal_reference_required(self):
        self.product.legal_reference = ''
        with self.assertRaises(ValidationError):
            self.product.full_clean()
        self.product.save()
        self.assertEqual(self.add().status_code, 403)

    def test_category_and_cart_flags(self):
        self.category.online_enabled = False
        self.category.save()
        self.assertEqual(self.add().status_code, 403)
        self.category.online_enabled = True
        self.category.save()
        FeatureFlag.objects.filter(key='cart').update(is_enabled=False)
        self.assertEqual(self.add().status_code, 403)

    def test_age_requires_boolean_true(self):
        for adult in [False, 'true', 1, None]:
            self.client.post('/api/v1/session/', {'adult': adult}, content_type='application/json')
            self.assertEqual(self.add().status_code, 403)

    def test_invalid_quantities_and_malformed_body(self):
        for quantity in [0, -1, 21, 1.5, '1', True, None]:
            self.assertEqual(self.add(quantity=quantity).status_code, 400)
        for body in ['[]', '{', 'null']:
            self.assertEqual(self.client.post('/api/v1/cart/', body, content_type='application/json').status_code, 400)

    def test_stock_and_price_validation(self):
        self.assertEqual(self.add(quantity=6).status_code, 409)
        self.product.price = 0
        self.product.save()
        self.assertEqual(self.add().status_code, 409)

    def test_persian_search_normalization(self):
        for query in ['کیف', 'كيف', 'کوچک', 'كوچك']:
            self.assertEqual(len(self.client.get('/api/v1/catalog/products/', {'q': query}).json()['data']), 1)

    def test_compatibility_filters_and_incompatible_exclusion(self):
        d = Device.objects.create(title='مدل', slug='device')
        rule = CompatibilityRule.objects.create(device=d, product=self.product, evidence_source='test', last_verified=date.today())
        self.assertEqual(len(self.client.get('/api/v1/catalog/products/', {'device': 'device'}).json()['data']), 1)
        rule.is_incompatible = True
        rule.save()
        self.assertEqual(self.client.get('/api/v1/catalog/products/', {'device': 'device'}).json()['data'], [])

    def test_guest_cart_isolation_and_update(self):
        self.assertEqual(self.add(quantity=2).status_code, 200)
        self.assertEqual(self.add(quantity=3).status_code, 200)
        self.assertEqual(CartItem.objects.get().quantity, 3)
        other = Client()
        self.assertEqual(other.get('/api/v1/cart/').json()['data']['items'], [])
        other.delete('/api/v1/cart/', {'product_id': self.product.pk}, content_type='application/json')
        self.assertEqual(CartItem.objects.count(), 1)

    def test_revoked_product_removed_from_cart(self):
        self.add()
        self.product.legal_status = 'BLOCKED'
        self.product.save()
        self.assertEqual(self.client.get('/api/v1/cart/').json()['data']['items'], [])

    def test_recent_order_is_recoverable_only_in_owner_cart(self):
        self.add()
        order_id = self.order().json()['data']['id']
        self.assertEqual(self.client.get('/api/v1/cart/').json()['data']['latest_order_id'], order_id)
        self.assertIsNone(Client().get('/api/v1/cart/').json()['data']['latest_order_id'])

    def test_csrf_enforced_for_anonymous_cart(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/v1/session/', {'adult': True}, content_type='application/json').status_code, 403)
        token = client.get('/api/v1/session/').json()['data']['csrf_token']
        self.assertEqual(client.post('/api/v1/session/', {'adult': True}, content_type='application/json', HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertEqual(self.add(client=client).status_code, 403)

    def test_order_reservation_and_idempotency(self):
        self.add(quantity=2)
        key = uuid.uuid4()
        first = self.order(key=key)
        second = self.order(key=key)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json(), second.json())
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 3)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(StockLedger.objects.get().delta, -2)
        self.assertEqual(first.json()['data']['total'], 200000)
        self.assertFalse(CartItem.objects.exists())

    def test_checkout_revalidates_policy_and_rolls_back(self):
        self.add(quantity=2)
        self.category.online_enabled = False
        self.category.save()
        self.assertEqual(self.order().status_code, 403)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertFalse(Order.objects.exists())

    def test_checkout_stock_change_and_atomic_rollback(self):
        p2 = Product.objects.create(title='ابزار', slug='second', sku='SECOND', category=self.category,
                                    stock=2, price=50000, legal_status='APPROVED_ONLINE', legal_reference='test')
        self.add(quantity=2)
        self.add(product=p2, quantity=2)
        Product.objects.filter(pk=p2.pk).update(stock=1)
        self.assertEqual(self.order().status_code, 409)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertFalse(StockLedger.objects.exists())
        self.assertFalse(Order.objects.exists())

    def test_order_ownership_and_key_conflict(self):
        self.add()
        key = uuid.uuid4()
        result = self.order(key=key).json()['data']
        self.assertEqual(self.client.get(f"/api/v1/orders/{result['id']}/").status_code, 200)
        other = Client()
        other.post('/api/v1/session/', {'adult': True}, content_type='application/json')
        self.assertEqual(other.get(f"/api/v1/orders/{result['id']}/").status_code, 404)
        self.assertEqual(self.order(client=other, key=key).status_code, 409)

    def test_disabled_checkout_invalid_key_and_empty_cart(self):
        self.assertEqual(self.order().status_code, 400)
        self.assertEqual(self.order(key='invalid').status_code, 400)
        self.add()
        FeatureFlag.objects.filter(key='order_requests').update(is_enabled=False)
        self.assertEqual(self.order().status_code, 503)

    def test_cancel_releases_stock_once(self):
        self.add(quantity=2)
        result = self.order().json()['data']
        for _ in range(2):
            call_command('cancel_order', result['id'], stdout=io.StringIO())
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertEqual(StockLedger.objects.count(), 2)
        self.assertEqual(Order.objects.get().status, 'CANCELLED')

    def test_catalog_admin_cannot_change_legal_fields(self):
        staff = User.objects.create_user('catalog-editor', password='test-password', is_staff=True)
        staff.user_permissions.set(Permission.objects.filter(codename__in=['view_product', 'change_product']))
        self.client.force_login(staff)
        response = self.client.get(f'/admin/shop/product/{self.product.pk}/change/')
        form = response.context['adminform'].form
        self.assertNotIn('legal_status', form.fields)
        self.assertNotIn('legal_reference', form.fields)

    def test_sample_seed_is_repeatable_and_never_enables_sales(self):
        for _ in range(2):
            call_command('seed_demo', stdout=io.StringIO())
        self.assertEqual(Product.objects.filter(sku__startswith='DEMO-').count(), 14)
        self.assertFalse(Product.objects.filter(sku__startswith='DEMO-', legal_status='APPROVED_ONLINE').exists())
        self.assertFalse(Category.objects.get(slug='regular').online_enabled)

    def test_cigarette_never_enters_online_cart_even_if_approval_is_misconfigured(self):
        self.product.product_type = 'cigarette'
        with self.assertRaises(ValidationError):
            self.product.full_clean()
        self.product.save()
        self.assertEqual(self.add().status_code, 403)
        self.assertFalse(self.client.get('/api/v1/catalog/products/').json()['data'][0]['purchasable'])

    def test_cigarette_catalog_modes_and_brand_search(self):
        call_command('seed_demo', stdout=io.StringIO())
        endpoint = '/api/v1/catalog/products/'
        all_cigarettes = self.client.get(endpoint, {'type': 'cigarette'}).json()['data']
        self.assertEqual(len(all_cigarettes), 14)
        self.assertTrue(all(p['brand'] == 'Winston' and not p['purchasable'] for p in all_cigarettes))
        self.assertEqual(len(self.client.get(endpoint, {'type': 'cigarette', 'mode': 'wholesale'}).json()['data']), 13)
        self.assertEqual(len(self.client.get(endpoint, {'type': 'cigarette', 'mode': 'retail'}).json()['data']), 13)
        self.assertEqual(len(self.client.get(endpoint, {'type': 'cigarette', 'q': 'كامپكت'}).json()['data']), 2)
        self.assertEqual(len(self.client.get(endpoint, {'type': 'cigarette', 'brand': 'Winston'}).json()['data']), 14)
        categories = self.client.get('/api/v1/catalog/', {'type': 'cigarette'}).json()['data']['categories']
        self.assertEqual({c['slug'] for c in categories}, {'regular', 'xs', 'nova', 'superslim', 'x-style', 'compact'})

    def test_product_default_new_fields_and_health(self):
        self.assertEqual(self.client.get('/api/v1/health/').json()['data']['status'], 'ok')

    def test_winston_photos_match_models_and_upload_has_priority(self):
        call_command('seed_demo', stdout=io.StringIO())
        data = self.client.get('/api/v1/catalog/products/', {'type': 'cigarette'}).json()['data']
        self.assertEqual(len({p['image'] for p in data}), 14)
        self.assertEqual([p['image'] for p in data],
                         [f'/images/products/winston/optimized/{number:02}.webp' for number in range(1, 15)])
        by_slug = {p['slug']: p for p in data}
        for slug, number in [('winston-red', '07'), ('winston-silver', '12'),
                             ('winston-xs-black', '13'), ('winston-superslim-silver', '01')]:
            self.assertEqual(by_slug[slug]['image'], f'/images/products/winston/optimized/{number}.webp')
            self.assertIsNone(by_slug[slug]['sticks_per_pack'])
            self.assertIsNone(by_slug[slug]['packs_per_carton'])
        product = Product.objects.get(slug='winston-red')
        product.image = 'products/seller-upload.png'
        product.save()
        response = self.client.get('/api/v1/catalog/products/winston-red/').json()['data']
        self.assertEqual(response['image'], '/media/products/seller-upload.png')

    def test_photo_catalog_upgrades_legacy_samples_and_preserves_seller_edits(self):
        from .winston_catalog import LEGACY_DESCRIPTION
        category = Category.objects.create(title='قدیمی', slug='slim')
        legacy = Product.objects.create(title='وینستون XS آبی', slug='winston-xs-blue', sku='DEMO-CIG-003',
            category=category, product_type='cigarette', brand='Winston', description=LEGACY_DESCRIPTION,
            sticks_per_pack=20, packs_per_carton=10, legal_status='IN_PERSON_ONLY')
        edited = Product.objects.create(title='عنوان فروشنده', slug='winston-blue', sku='DEMO-CIG-002',
            category=category, product_type='cigarette', brand='Winston', description='متن فروشنده',
            sticks_per_pack=25, packs_per_carton=8, stock=11, price=123456, active=False,
            legal_status='BLOCKED', catalog_image='/images/custom.webp')
        audited = Product.objects.create(title='وینستون سیلور', slug='winston-silver', sku='DEMO-CIG-007',
            category=category, product_type='cigarette', brand='Winston', description=LEGACY_DESCRIPTION,
            sticks_per_pack=20, packs_per_carton=10, legal_status='IN_PERSON_ONLY')
        AuditLog.objects.create(actor='seller', action='ADMIN_UPDATE', entity=f'product:{audited.pk}',
                                changes={'sticks_per_pack': {'before': '25', 'after': '20'}})
        for _ in range(2):
            call_command('seed_demo', stdout=io.StringIO())
        legacy.refresh_from_db()
        self.assertEqual(legacy.category.slug, 'xs')
        self.assertIsNone(legacy.sticks_per_pack)
        self.assertIsNone(legacy.packs_per_carton)
        self.assertEqual(legacy.catalog_image, '/images/products/winston/optimized/04.webp')
        edited.refresh_from_db()
        self.assertEqual((edited.title, edited.description, edited.category_id),
                         ('عنوان فروشنده', 'متن فروشنده', category.pk))
        self.assertEqual((edited.sticks_per_pack, edited.packs_per_carton, edited.stock, edited.price),
                         (25, 8, 11, 123456))
        self.assertFalse(edited.active)
        self.assertEqual(edited.legal_status, 'BLOCKED')
        self.assertEqual(edited.catalog_image, '/images/custom.webp')
        audited.refresh_from_db()
        self.assertEqual((audited.sticks_per_pack, audited.packs_per_carton), (20, 10))
        self.assertEqual(audited.description, LEGACY_DESCRIPTION)
        self.assertEqual(audited.category_id, category.pk)

    def test_unpublished_branches_hidden(self):
        branch = Branch.objects.create(title='شعبه', city='تهران', address='نشانی آزمون', phone='test', hours='test')
        self.assertEqual(self.client.get('/api/v1/branches/').json()['data'], [])
        branch.active = True
        branch.save()
        self.assertEqual(len(self.client.get('/api/v1/branches/').json()['data']), 1)

    def test_admin_stock_edit_writes_audit_and_ledger(self):
        from .admin import ProductAdmin
        from django.contrib.admin.sites import AdminSite
        from django.test import RequestFactory
        from types import SimpleNamespace
        request = RequestFactory().post('/')
        request.user = User.objects.create_superuser('owner', password='test-password')
        self.product.stock = 9
        ProductAdmin(Product, AdminSite()).save_model(request, self.product, SimpleNamespace(changed_data=['stock']), True)
        self.assertEqual(StockLedger.objects.get().delta, 4)
        self.assertEqual(AuditLog.objects.get().changes['stock']['before'], '5')


@skipUnless(connection.vendor == 'postgresql', 'Row-lock concurrency is validated on PostgreSQL, not SQLite')
class ConcurrentCheckoutTests(TransactionTestCase):
    def setUp(self):
        category = Category.objects.create(title='test', slug='test', online_enabled=True)
        self.product = Product.objects.create(title='test', slug='test', sku='TEST', category=category, stock=1,
                                             price=100, legal_status='APPROVED_ONLINE', legal_reference='test-only')
        FeatureFlag.objects.create(key='cart', is_enabled=True)
        FeatureFlag.objects.create(key='order_requests', is_enabled=True)
        self.carts = [Cart.objects.create(session_key=f'test-{i}') for i in range(2)]
        for cart in self.carts:
            CartItem.objects.create(cart=cart, product=self.product)

    def run_parallel(self, cart_ids, keys):
        barrier = Barrier(2)
        def request(index):
            try:
                cart = Cart.objects.get(pk=cart_ids[index])
                barrier.wait(timeout=10)
                try:
                    return str(checkout(cart, keys[index]).pk)
                except ShopError as error:
                    return error.code
            finally:
                connections['default'].close()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(request, range(2)))

    def test_two_carts_cannot_reserve_last_item(self):
        results = self.run_parallel([c.pk for c in self.carts], [uuid.uuid4(), uuid.uuid4()])
        self.assertEqual(results.count('OUT_OF_STOCK'), 1)
        self.assertEqual(Order.objects.count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)

    def test_same_cart_concurrent_retries_reserve_once(self):
        key = uuid.uuid4()
        results = self.run_parallel([self.carts[0].pk] * 2, [key, key])
        self.assertEqual(results[0], results[1])
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(StockLedger.objects.count(), 1)


    def prepare_offer(self):
        from .models import Offer, Vendor
        vendor = Vendor.objects.create(title='Seller', slug='seller', active=True)
        offer = Offer.objects.create(product=self.product, vendor=vendor, stock=1, price=150, approved=True)
        CartItem.objects.update(offer=offer)
        return offer

    def test_two_carts_cannot_reserve_last_seller_item(self):
        offer = self.prepare_offer()
        results = self.run_parallel([c.pk for c in self.carts], [uuid.uuid4(), uuid.uuid4()])
        self.assertEqual(results.count('OUT_OF_STOCK'), 1)
        self.assertEqual(Order.objects.count(), 1)
        offer.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(offer.stock, 0)
        self.assertEqual(self.product.stock, 1)

    def test_same_cart_concurrent_offer_retries_reserve_once(self):
        self.prepare_offer()
        key = uuid.uuid4()
        results = self.run_parallel([self.carts[0].pk] * 2, [key, key])
        self.assertEqual(results[0], results[1])
        self.assertEqual(StockLedger.objects.count(), 1)

    def test_concurrent_cancellation_restores_seller_stock_once(self):
        from .services import cancel_reservation
        offer = self.prepare_offer()
        order = checkout(self.carts[0], uuid.uuid4())
        barrier = Barrier(2)
        def cancel(index):
            try:
                barrier.wait(timeout=10)
                return cancel_reservation(order.pk)
            finally:
                connections['default'].close()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(cancel, range(2)))
        self.assertEqual(sorted(results), [False, True])
        offer.refresh_from_db()
        self.assertEqual(offer.stock, 1)
        self.assertEqual(StockLedger.objects.count(), 2)

class MarketplaceTests(TestCase):
    def setUp(self):
        from .models import Offer, Vendor
        self.category = Category.objects.create(title='ابزار', slug='tools', online_enabled=True)
        self.product = Product.objects.create(title='کیف', slug='case', sku='CASE', category=self.category,
            price=999, stock=99, legal_status='APPROVED_ONLINE', legal_reference='test')
        self.vendors = [Vendor.objects.create(title=f'فروشنده {i}', slug=f'vendor-{i}', active=True) for i in range(2)]
        self.offers = [Offer.objects.create(product=self.product, vendor=v, price=100 + i * 50, stock=3, approved=True)
                       for i, v in enumerate(self.vendors)]
        for key in ['cart', 'order_requests']:
            FeatureFlag.objects.create(key=key, is_enabled=True)
        self.client.post('/api/v1/session/', {'adult': True}, content_type='application/json')

    def add_offer(self, offer, quantity=1):
        return self.client.post('/api/v1/cart/', {'product_id': offer.product_id, 'offer_id': offer.pk, 'quantity': quantity}, content_type='application/json')

    def test_every_product_and_brand_is_reachable_beyond_one_hundred(self):
        Product.objects.bulk_create([Product(title=f'Item {i}', slug=f'item-{i}', sku=f'SKU-{i}', category=self.category,
            brand='Last Brand' if i == 120 else 'First Brand', legal_status='CATALOG_ONLY') for i in range(121)])
        ids = []
        for page in range(1, 7):
            data = self.client.get('/api/v1/catalog/products/', {'pagination': '1', 'page_size': 24, 'page': page}).json()['data']
            ids.extend(p['id'] for p in data['items'])
            self.assertEqual(data['total'], 122)
        self.assertEqual(len(set(ids)), 122)
        self.assertIn('Last Brand', self.client.get('/api/v1/catalog/').json()['data']['brands'])
        self.assertEqual(len(self.client.get('/api/v1/catalog/products/', {'brand': 'Last Brand'}).json()['data']), 1)

    def test_pagination_rejects_invalid_values(self):
        for params in [{'page': 'no'}, {'page': 0}, {'page_size': 0}, {'page_size': 101}]:
            self.assertEqual(self.client.get('/api/v1/catalog/products/', params).status_code, 400)

    def test_hidden_items_do_not_leak_facets(self):
        category = Category.objects.create(title='Secret', slug='secret')
        Product.objects.create(title='Hidden', slug='hidden', sku='HIDDEN', category=category, brand='Secret', legal_status='BLOCKED')
        data = self.client.get('/api/v1/catalog/').json()['data']
        self.assertNotIn('Secret', data['brands'])
        self.assertNotIn('secret', [c['slug'] for c in data['categories']])

    def test_offer_policy_filters_stock_and_vendor(self):
        self.offers[0].approved = False
        self.offers[0].save()
        self.assertEqual(self.client.get('/api/v1/catalog/products/', {'vendor': 'vendor-0'}).json()['data'], [])
        self.vendors[1].active = False
        self.vendors[1].save()
        data = self.client.get('/api/v1/catalog/products/case/').json()['data']
        self.assertEqual(data['offers'], [])
        self.assertFalse(data['purchasable'])
        self.assertEqual(data['stock'], 0)
        self.assertEqual(self.add_offer(self.offers[0]).status_code, 403)

    def test_tobacco_stays_catalog_only_despite_misconfigured_approval(self):
        self.product.product_type = 'tobacco'
        with self.assertRaises(ValidationError):
            self.product.full_clean()
        self.product.save()
        data = self.client.get('/api/v1/catalog/products/case/').json()['data']
        self.assertIsNone(data['price'])
        self.assertTrue(all(o['price'] is None for o in data['offers']))
        self.assertEqual(self.add_offer(self.offers[0]).status_code, 403)

    def test_two_sellers_reserve_separate_stock_and_snapshot_names(self):
        from .models import Offer, OrderItem
        for offer in self.offers:
            self.assertEqual(self.add_offer(offer, 2).status_code, 200)
        self.assertEqual(CartItem.objects.count(), 2)
        key = str(uuid.uuid4())
        first = self.client.post('/api/v1/orders/', {'idempotency_key': key}, content_type='application/json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json()['data']['total'], 500)
        self.assertEqual(self.client.post('/api/v1/orders/', {'idempotency_key': key}, content_type='application/json').json(), first.json())
        self.assertEqual(list(Offer.objects.order_by('pk').values_list('stock', flat=True)), [1, 1])
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 99)
        self.assertEqual(set(OrderItem.objects.values_list('seller_name', flat=True)), {'فروشنده 0', 'فروشنده 1'})

    def test_expiry_releases_each_seller_stock_exactly_once(self):
        from datetime import timedelta
        from django.utils import timezone
        from .models import Offer
        self.add_offer(self.offers[0], 2)
        order = checkout(Cart.objects.get(), uuid.uuid4())
        Order.objects.filter(pk=order.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        for _ in range(2):
            call_command('expire_orders', stdout=io.StringIO())
        order.refresh_from_db()
        self.assertEqual(order.status, 'EXPIRED')
        self.assertEqual(Offer.objects.get(pk=self.offers[0].pk).stock, 3)
        self.assertEqual(StockLedger.objects.count(), 2)

    def test_delete_one_offer_keeps_other_seller_and_other_cart_private(self):
        for offer in self.offers:
            self.add_offer(offer)
        item = CartItem.objects.first()
        other = Client()
        other.delete('/api/v1/cart/', {'item_id': item.pk}, content_type='application/json')
        self.assertEqual(CartItem.objects.count(), 2)
        self.client.delete('/api/v1/cart/', {'item_id': item.pk}, content_type='application/json')
        self.assertEqual(CartItem.objects.count(), 1)

    def test_seller_admin_cannot_view_other_offers_or_approve_own_offer(self):
        from django.contrib.admin.sites import AdminSite
        from django.test import RequestFactory
        from .admin import OfferAdmin, SellerOrderItemAdmin
        from .models import Offer, OrderItem
        call_command('seed_roles', stdout=io.StringIO())
        from django.contrib.auth.models import Group
        seller = User.objects.create_user('seller', is_staff=True)
        seller.groups.add(Group.objects.get(name='Seller'))
        self.vendors[0].members.add(seller)
        request = RequestFactory().get('/')
        request.user = seller
        offer_admin = OfferAdmin(Offer, AdminSite())
        self.assertEqual(list(offer_admin.get_queryset(request)), [self.offers[0]])
        self.assertIn('approved', offer_admin.get_readonly_fields(request, self.offers[0]))
        form = offer_admin.get_form(request, self.offers[0])
        self.assertNotIn('approved', form.base_fields)
        self.assertNotIn('vendor', form.base_fields)
        self.add_offer(self.offers[0])
        self.add_offer(self.offers[1])
        checkout(Cart.objects.get(), uuid.uuid4())
        rows = SellerOrderItemAdmin(OrderItem, AdminSite()).get_queryset(request)
        self.assertEqual(rows.count(), 1)
        self.assertEqual(rows.get().offer_id, self.offers[0].pk)
        self.client.force_login(seller)
        response = self.client.get(f'/admin/shop/offer/{self.offers[1].pk}/change/')
        self.assertNotEqual(response.status_code, 200)
        response = self.client.post('/admin/shop/offer/add/', {
            'vendor': self.vendors[1].pk, 'product': self.product.pk, 'seller_sku': 'FORGED',
            'price': 1, 'stock': 1, 'active': 'on', 'approved': 'on', 'retail_available': 'on',
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('vendor', response.context['adminform'].form.errors)

    def test_source_enrichment_preserves_unknown_counts_and_seller_edits(self):
        call_command('seed_demo', stdout=io.StringIO())
        p = Product.objects.get(slug='winston-red')
        self.assertEqual(p.source_url, 'https://www.jti.com/en/our-brands')
        self.assertIsNone(p.sticks_per_pack)
        p.source_url = 'https://example.com/seller'
        p.save()
        call_command('seed_demo', stdout=io.StringIO())
        p.refresh_from_db()
        self.assertEqual(p.source_url, 'https://example.com/seller')

    def test_catalog_serialization_queries_are_bounded(self):
        from django.test.utils import CaptureQueriesContext
        Product.objects.bulk_create([Product(title=f'Accessory {i}', slug=f'accessory-{i}', sku=f'AC-{i}',
            category=self.category, legal_status='APPROVED_ONLINE', legal_reference='test', price=10) for i in range(45)])
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get('/api/v1/catalog/products/', {'pagination': '1', 'page_size': 50})
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(queries), 9)

    def test_available_filter_uses_the_same_offer_as_sale_mode(self):
        self.offers[0].stock = 0
        self.offers[0].save()
        self.offers[1].retail_available = False
        self.offers[1].wholesale_available = True
        self.offers[1].save()
        params = {'mode': 'retail', 'available': '1'}
        self.assertEqual(self.client.get('/api/v1/catalog/products/', params).json()['data'], [])
        params['mode'] = 'wholesale'
        data = self.client.get('/api/v1/catalog/products/', params).json()['data']
        self.assertEqual(len(data), 1)
        self.assertTrue(data[0]['wholesale_available'])

    def test_order_operator_sees_all_lines_and_inventory_without_offer_editing(self):
        from django.contrib.admin.sites import AdminSite
        from django.contrib.auth.models import Group
        from django.test import RequestFactory
        from .admin import SellerOrderItemAdmin, LedgerAdmin, OfferAdmin
        from .models import OrderItem, Offer
        call_command('seed_roles', stdout=io.StringIO())
        operator = User.objects.create_user('operator', is_staff=True)
        operator.groups.add(Group.objects.get(name='Order operator'))
        for offer in self.offers:
            self.add_offer(offer)
        checkout(Cart.objects.get(), uuid.uuid4())
        request = RequestFactory().get('/')
        request.user = operator
        self.assertEqual(SellerOrderItemAdmin(OrderItem, AdminSite()).get_queryset(request).count(), 2)
        self.assertEqual(LedgerAdmin(StockLedger, AdminSite()).get_queryset(request).count(), 2)
        self.assertFalse(OfferAdmin(Offer, AdminSite()).has_change_permission(request))
