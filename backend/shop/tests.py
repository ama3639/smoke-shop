import io
import uuid
from datetime import date
from django.contrib.auth.models import Group, Permission, User
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

    def test_anonymous_cart_read_does_not_allocate_a_competing_session(self):
        from django.conf import settings
        from django.contrib.sessions.models import Session
        guest = Client()
        before_carts, before_sessions = Cart.objects.count(), Session.objects.count()
        response = guest.get('/api/v1/cart/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data'], {'items': [], 'total': 0,
            'checkout_enabled': True, 'latest_order_id': None})
        self.assertNotIn(settings.SESSION_COOKIE_NAME, response.cookies)
        self.assertEqual(Cart.objects.count(), before_carts)
        self.assertEqual(Session.objects.count(), before_sessions)
        guest.cookies[settings.SESSION_COOKIE_NAME] = 'expired-test-session'
        self.assertEqual(guest.get('/api/v1/cart/').json()['data']['items'], [])
        self.assertEqual(Cart.objects.count(), before_carts)
        self.assertEqual(Session.objects.count(), before_sessions)
        guest.post('/api/v1/session/', {'adult': True}, content_type='application/json')
        self.assertEqual(self.add(client=guest).status_code, 200)

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

    def run_bulk_against(self, cancel=False):
        from .operations import apply_preview, preview
        from .services import cancel_reservation
        offer = self.prepare_offer()
        user = User.objects.create_superuser('bulk-concurrency', password='test-only')
        order = checkout(self.carts[0], uuid.uuid4()) if cancel else None
        offer.refresh_from_db()
        token = preview(user, [{'offer_id': str(offer.pk), 'product_sku': self.product.sku,
            'vendor_slug': offer.vendor.slug, 'price': '170', 'stock': '3',
            'updated_at': offer.updated_at.isoformat()}])['token']
        barrier = Barrier(2)
        def run(index):
            try:
                barrier.wait(timeout=10)
                try:
                    if index == 0:
                        apply_preview(User.objects.get(pk=user.pk), token)
                        return 'UPDATED'
                    if cancel:
                        cancel_reservation(order.pk)
                    else:
                        checkout(Cart.objects.get(pk=self.carts[0].pk), uuid.uuid4())
                    return 'ORDER_OK'
                except ShopError as error:
                    return error.code
            finally:
                connections['default'].close()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(run, range(2)))
        self.assertEqual(results[1], 'ORDER_OK')
        self.assertIn(results[0], ['UPDATED', 'STALE_PREVIEW'])
        offer.refresh_from_db()
        self.assertEqual(offer.stock, 1 + sum(StockLedger.objects.values_list('delta', flat=True)))
        self.assertEqual(Order.objects.count(), 1)

    def test_price_import_and_reservation_preserve_inventory(self):
        self.run_bulk_against()

    def test_price_import_and_cancellation_preserve_inventory(self):
        self.run_bulk_against(cancel=True)


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



class AccountTests(TestCase):
    password = 'T1tanium-safe-Complex$2026'

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.category = Category.objects.create(title='Account test', slug='account-test', online_enabled=True)
        self.product = Product.objects.create(title='Account case', slug='account-case', sku='ACCOUNT-CASE',
            category=self.category, price=100000, stock=5, legal_status='APPROVED_ONLINE', legal_reference='test-only')
        FeatureFlag.objects.create(key='cart', is_enabled=True)
        FeatureFlag.objects.create(key='order_requests', is_enabled=True)

    def post(self, data, client=None):
        return (client or self.client).post('/api/v1/account/', data, content_type='application/json')

    def register(self, username='titanium-user'):
        return self.post({'action': 'register', 'username': username, 'password': self.password,
            'confirm': self.password, 'adult': True, 'name': 'نام آزمون', 'email': 'test@example.com'})

    def test_register_preserves_guest_cart_and_creates_only_regular_user(self):
        self.client.post('/api/v1/session/', {'adult': True}, content_type='application/json')
        self.client.post('/api/v1/cart/', {'product_id': self.product.pk, 'quantity': 2}, content_type='application/json')
        before = Cart.objects.get(session_key=self.client.session.session_key)
        self.assertEqual(self.register().status_code, 200)
        user = User.objects.get(username='titanium-user')
        self.assertTrue(user.check_password(self.password))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.email, 'test@example.com')
        before.refresh_from_db()
        self.assertEqual(before.user, user)
        self.assertEqual(before.session_key, self.client.session.session_key)
        self.assertEqual(self.client.get('/api/v1/cart/').json()['data']['items'][0]['quantity'], 2)
        self.assertEqual(self.client.get('/api/v1/cart/').json()['data']['total'], 200000)

    def test_guest_orders_become_private_account_history_across_logout_login(self):
        self.client.post('/api/v1/session/', {'adult': True}, content_type='application/json')
        self.client.post('/api/v1/cart/', {'product_id': self.product.pk}, content_type='application/json')
        result = self.client.post('/api/v1/orders/', {'idempotency_key': str(uuid.uuid4())}, content_type='application/json')
        oid = result.json()['data']['id']
        self.assertEqual(self.register().status_code, 200)
        self.assertEqual(self.client.get('/api/v1/account/').json()['data']['orders'][0]['id'], oid)
        self.post({'action': 'logout'})
        self.assertEqual(self.client.get('/api/v1/orders/' + oid + '/').status_code, 404)
        self.assertEqual(self.client.get('/api/v1/account/').json()['data']['orders'], [])
        self.post({'action': 'login', 'username': 'titanium-user', 'password': self.password})
        self.assertEqual(self.client.get('/api/v1/orders/' + oid + '/').status_code, 200)
        other = Client()
        User.objects.create_user(username='other-user', password=self.password)
        self.post({'action': 'login', 'username': 'other-user', 'password': self.password}, client=other)
        self.assertEqual(other.get('/api/v1/orders/' + oid + '/').status_code, 404)
        self.assertEqual(other.get('/api/v1/account/').json()['data']['orders'], [])

    def test_invalid_registration_profile_and_weak_password_do_not_write_user(self):
        data = {'action': 'register', 'username': 'bad-user', 'password': self.password, 'confirm': self.password}
        self.assertEqual(self.post(data).status_code, 403)
        data['adult'] = True
        data['password'] = data['confirm'] = '12345678'
        self.assertEqual(self.post(data).status_code, 400)
        data['password'] = data['confirm'] = self.password
        data['email'] = 'invalid'
        self.assertEqual(self.post(data).status_code, 400)
        self.assertFalse(User.objects.filter(username='bad-user').exists())

    def test_authentication_requires_csrf_and_profile_update_is_scoped(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(self.post({'action': 'login', 'username': 'test', 'password': 'bad'}, client).status_code, 403)
        self.register()
        self.assertEqual(self.post({'action': 'update', 'name': 'جدید', 'email': 'new@example.com'}).status_code, 200)
        self.assertEqual(User.objects.get(username='titanium-user').first_name, 'جدید')
        self.assertEqual(self.post({'action': 'update', 'name': {}, 'email': ''}).status_code, 400)
        self.assertEqual(self.post({'action': 'update', 'name': 'بدون تغییر', 'email': 'bad'}).status_code, 400)
        self.post({'action': 'logout'})
        self.assertEqual(self.post({'action': 'update', 'name': 'No', 'email': ''}).status_code, 403)

    def test_login_throttle_and_existing_short_username(self):
        User.objects.create_user(username='a', password=self.password)
        self.assertEqual(self.post({'action': 'login', 'username': 'a', 'password': self.password}).status_code, 200)
        self.post({'action': 'logout'})
        for _ in range(10):
            self.assertEqual(self.post({'action': 'login', 'username': 'a', 'password': 'wrong'}).status_code, 403)
        self.assertEqual(self.post({'action': 'login', 'username': 'a', 'password': 'wrong'}).status_code, 429)

    def test_order_history_is_paginated_and_owned(self):
        self.register()
        cart = Cart.objects.create(session_key='historical-cart', user=User.objects.get(username='titanium-user'))
        Order.objects.bulk_create([Order(cart=cart, idempotency_key=uuid.uuid4(), total=i) for i in range(21)])
        first = self.client.get('/api/v1/account/').json()['data']
        second = self.client.get('/api/v1/account/', {'order_page': 2}).json()['data']
        self.assertEqual(len(first['orders']), 20)
        self.assertEqual(len(second['orders']), 1)
        self.assertTrue(first['pagination']['has_next'])
        self.assertEqual(first['pagination']['total'], 21)
        self.assertEqual(self.client.get('/api/v1/account/', {'order_page': 0}).status_code, 400)


class TobaccoFacetTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(title='تنباکوی آزمون', slug='test-tobacco')
        for slug, flavor, weight in [('mint-small', 'نعناع', '50'), ('mint-large', 'نعناع', '250'), ('apple', 'سیب', '50')]:
            Product.objects.create(title=slug, slug=slug, sku=slug, category=self.category,
                product_type='tobacco', brand='Test Brand', flavor=flavor, weight_grams=weight,
                legal_status='CATALOG_ONLY')
        Product.objects.create(title='Unknown', slug='unknown', sku='unknown', category=self.category,
            product_type='tobacco', legal_status='CATALOG_ONLY')
        Product.objects.create(title='Hidden', slug='hidden', sku='hidden', category=self.category,
            product_type='tobacco', flavor='Secret', weight_grams=999, brand='Secret', legal_status='BLOCKED')
        Product.objects.create(title='Other', slug='other', sku='other', category=self.category,
            product_type='accessory', flavor='Not tobacco', weight_grams=123, legal_status='CATALOG_ONLY')

    def test_facets_include_only_known_public_tobacco_values(self):
        data = self.client.get('/api/v1/catalog/', {'type': 'tobacco'}).json()['data']
        self.assertCountEqual(data['flavors'], ['نعناع', 'سیب'])
        self.assertEqual(data['weights'], ['50.00', '250.00'])
        self.assertEqual(data['brands'], ['Test Brand'])
        self.assertEqual(self.client.get('/api/v1/catalog/', {'type': 'accessory'}).json()['data']['flavors'], [])

    def test_combined_filters_keep_existing_array_contract_and_purchase_policy(self):
        params = {'type': 'tobacco', 'brand': 'Test Brand', 'flavor': 'نعناع', 'weight': '250', 'category': 'test-tobacco'}
        result = self.client.get('/api/v1/catalog/products/', params).json()
        self.assertIsInstance(result['data'], list)
        self.assertEqual([p['slug'] for p in result['data']], ['mint-large'])
        self.assertEqual(result['data'][0]['weight_grams'], '250.00')
        self.assertFalse(result['data'][0]['purchasable'])
        self.assertIsNone(result['data'][0]['price'])
        params['pagination'] = '1'
        self.assertEqual(self.client.get('/api/v1/catalog/products/', params).json()['data']['total'], 1)

    def test_unknown_specs_remain_empty_and_invalid_weights_are_rejected(self):
        p = self.client.get('/api/v1/catalog/products/unknown/').json()['data']
        self.assertEqual(p['flavor'], '')
        self.assertIsNone(p['weight_grams'])
        for weight in ['NaN', 'Infinity', '-1', '0', '0.001', 'bad', '1000000', '50.000', '1e-99999999']:
            self.assertEqual(self.client.get('/api/v1/catalog/products/', {'weight': weight}).status_code, 400)
        self.assertEqual(self.client.get('/api/v1/catalog/products/', {'weight': '500'}).json()['data'], [])

    def test_flavor_is_searchable_with_persian_normalization(self):
        p = Product.objects.get(slug='apple')
        p.flavor = 'کرمی'; p.save()
        data = self.client.get('/api/v1/catalog/products/', {'q': 'كرمي'}).json()['data']
        self.assertEqual([p['slug'] for p in data], ['apple'])


class OperationsTests(TestCase):
    def setUp(self):
        from .models import Offer, Vendor
        call_command('seed_roles', verbosity=0)
        self.user = User.objects.create_user('operations-seller', is_staff=True)
        self.user.groups.add(Group.objects.get(name='Seller'))
        category = Category.objects.create(title='آزمون', slug='operations')
        self.product = Product.objects.create(title='کیف', sku='=SKU', slug='operations-case', category=category)
        self.vendor = Vendor.objects.create(title='فروشنده', slug='operations-vendor', active=True)
        self.vendor.members.add(self.user)
        self.other_vendor = Vendor.objects.create(title='دیگر', slug='other-vendor', active=True)
        self.offer = Offer.objects.create(product=self.product, vendor=self.vendor, price=100, stock=4, approved=False)
        self.other = Offer.objects.create(product=self.product, vendor=self.other_vendor, price=200, stock=8)
        self.client.force_login(self.user)

    def post(self, payload, client=None):
        return (client or self.client).post('/api/v1/operations/', payload, content_type='application/json')

    def row(self, offer=None, **changes):
        o = offer or self.offer
        row = {'offer_id': str(o.pk), 'product_sku': o.product.sku, 'vendor_slug': o.vendor.slug,
               'price': '150', 'stock': '6', 'updated_at': o.updated_at.isoformat()}
        return {**row, **changes}

    def token(self, rows=None):
        from .operations import preview
        return preview(self.user, rows or [self.row()])['token']

    def test_scoped_dashboard_and_privilege_boundary(self):
        data = self.client.get('/api/v1/operations/').json()['data']
        self.assertEqual([r['id'] for r in data['rows']], [self.offer.pk])
        self.assertEqual(data['stats']['عرضه و موجودی'], 1)
        self.assertIn('no-store', self.client.get('/api/v1/operations/')['Cache-Control'])
        for section in ['products', 'vendors', 'orders', 'audit']:
            self.assertEqual(self.client.get('/api/v1/operations/', {'section': section}).status_code, 403)
        self.assertEqual(self.client.get('/api/v1/operations/', {'page': '-1'}).status_code, 400)
        self.assertEqual(self.client.get('/api/v1/operations/', {'q': 'no-match'}).json()['data']['rows'], [])

    def test_preview_does_not_write_and_confirm_keeps_approval(self):
        response = self.post({'action': 'edit', 'row': self.row()})
        self.assertEqual(response.status_code, 200)
        self.offer.refresh_from_db()
        self.assertEqual((self.offer.price, self.offer.stock), (100, 4))
        token = response.json()['data']['token']
        self.assertTrue(token)
        self.assertEqual(self.post({'action': 'confirm', 'token': token}).status_code, 200)
        self.offer.refresh_from_db()
        self.assertEqual((self.offer.price, self.offer.stock, self.offer.approved), (150, 6, False))
        self.assertEqual(StockLedger.objects.get().delta, 2)
        self.assertEqual(AuditLog.objects.get().actor, self.user.username)
        self.assertEqual(self.post({'action': 'confirm', 'token': token}).status_code, 409)
        self.assertEqual(StockLedger.objects.count(), 1)

    def test_stale_offer_rejects_entire_batch(self):
        from .models import Offer
        second_product = Product.objects.create(title='دوم', sku='SECOND', slug='second', category=self.product.category)
        second = Offer.objects.create(product=second_product, vendor=self.vendor, price=10, stock=2)
        token = self.token([self.row(), self.row(second)])
        second.stock = 1
        second.save()
        self.assertEqual(self.post({'action': 'confirm', 'token': token}).status_code, 409)
        self.offer.refresh_from_db()
        self.assertEqual(self.offer.price, 100)
        self.assertFalse(AuditLog.objects.exists())

    def test_invalid_rows_and_cross_vendor_cannot_be_confirmed(self):
        from .operations import preview
        for changes in [{'price': '-1'}, {'stock': '1.5'}, {'price': '9007199254740992'}, {'product_sku': 'WRONG'}, {'vendor_slug': 'other-vendor'}, {'updated_at': 'old'}, {'offer_id': '9' * 5000}]:
            result = preview(self.user, [self.row(**changes)])
            self.assertIsNone(result['token'])
            self.assertTrue(result['errors'])
        for rows in [[self.row(self.other)], [self.row(), self.row()], [None]]:
            self.assertIsNone(preview(self.user, rows)['token'])
        self.assertEqual(self.post({'action': 'preview', 'csv': 'bad,header\n1,2'}).status_code, 400)
        self.assertEqual(self.post({'action': 'confirm', 'token': 'tampered'}).status_code, 400)
        self.assertFalse(AuditLog.objects.exists())

    def test_export_roundtrip_and_spreadsheet_safety(self):
        import csv
        response = self.client.get('/api/v1/operations/?export=csv')
        text = response.content.decode('utf-8-sig')
        rows = list(csv.DictReader(io.StringIO(text)))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['product_sku'], "'=SKU")
        preview = self.post({'action': 'preview', 'csv': text}).json()['data']
        self.assertEqual(preview['errors'], [])
        self.assertTrue(preview['token'])

    def test_membership_and_permissions_rechecked(self):
        token = self.token()
        self.vendor.members.remove(self.user)
        self.assertEqual(self.post({'action': 'confirm', 'token': token}).status_code, 409)
        self.vendor.members.add(self.user)
        self.user.groups.clear()
        self.assertEqual(self.post({'action': 'confirm', 'token': token}).status_code, 403)

    def test_authentication_token_binding_and_csrf(self):
        guest = Client()
        self.assertEqual(guest.get('/api/v1/operations/').status_code, 401)
        customer = User.objects.create_user('ordinary')
        guest.force_login(customer)
        self.assertEqual(guest.get('/api/v1/operations/').status_code, 403)
        csrf = Client(enforce_csrf_checks=True)
        csrf.force_login(self.user)
        self.assertEqual(self.post({'action': 'confirm', 'token': self.token()}, client=csrf).status_code, 403)
        other_staff = User.objects.create_superuser('other-admin', password='test-only-password')
        guest.force_login(other_staff)
        self.assertEqual(self.post({'action': 'confirm', 'token': self.token()}, client=guest).status_code, 403)

    def test_manager_can_view_all_and_operator_cannot_edit_offers(self):
        from django.contrib.auth.models import Group
        admin = User.objects.create_superuser('central-admin', password='test-only-password')
        self.client.force_login(admin)
        data = self.client.get('/api/v1/operations/').json()['data']
        self.assertEqual(data['total'], 2)
        self.user.groups.set([Group.objects.get(name='Order operator')])
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/v1/operations/?section=offers').status_code, 403)
        self.assertEqual(self.post({'action': 'edit', 'row': self.row()}).status_code, 403)


class OperationsRecordTests(TestCase):
    post = OperationsTests.post

    def setUp(self):
        OperationsTests.setUp(self)
        self.admin = User.objects.create_superuser('record-manager', password='test-only-password')

    def record(self, section, rid):
        return self.client.get('/api/v1/operations/', {'section': section, 'record': rid})

    def fields(self, record):
        return {f['name']: f['value'] for f in record['fields'] if f['kind'] != 'file'}

    def save(self, record, **values):
        return self.post({'action': 'save_record', 'token': record['token'], **self.fields(record), **values})

    def test_product_form_validation_audit_and_stale_edit(self):
        self.client.force_login(self.admin)
        form = self.record('products', self.product.pk).json()['data']
        self.assertNotIn('legal_status', self.fields(form))
        self.assertEqual(self.save(form, title='عنوان تازه', description='مشخصات واقعی', legal_status='APPROVED_ONLINE').status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.title, 'عنوان تازه')
        self.assertEqual(self.product.legal_status, 'REVIEW_REQUIRED')
        self.assertTrue(AuditLog.objects.filter(action='OPERATIONS_UPDATE', actor=self.admin.username).exists())
        self.assertEqual(self.save(form, title='کهنه').status_code, 409)
        new = self.record('products', 'new').json()['data']
        self.assertEqual(self.save(new, title='جدید', slug='new-record', sku='NEW', description='واقعی', category=self.product.category_id).status_code, 200)
        self.assertEqual(Product.objects.get(sku='NEW').legal_status, 'REVIEW_REQUIRED')
        self.assertEqual(self.save(new, title='تکراری', slug='new-record', sku='NEW', category=self.product.category_id).status_code, 400)

    def test_seller_record_scope_and_approval_cannot_be_forged(self):
        self.assertEqual(self.record('products', self.product.pk).status_code, 403)
        self.assertEqual(self.record('vendors', self.vendor.pk).status_code, 403)
        self.assertEqual(self.record('offers', self.other.pk).status_code, 404)
        form = self.record('offers', self.offer.pk).json()['data']
        self.assertEqual(self.save(form, seller_sku='LOCAL', approved=True, stock=999, price=999, vendor=self.other_vendor.pk).status_code, 200)
        self.offer.refresh_from_db()
        self.assertEqual((self.offer.approved, self.offer.stock, self.offer.price, self.offer.vendor_id), (False, 4, 100, self.vendor.pk))
        self.vendor.members.remove(self.user)
        self.assertEqual(self.save(form).status_code, 404)

    def test_create_offer_uses_scope_and_ledger(self):
        from .models import Offer
        self.product.legal_status = 'CATALOG_ONLY'
        self.product.save()
        second = Product.objects.create(title='دوم', sku='NEW-2', slug='new-2', category=self.product.category, legal_status='CATALOG_ONLY')
        form = self.record('offers', 'new').json()['data']
        self.assertEqual(self.save(form, vendor=self.other_vendor.pk, product=second.pk, price=10, stock=3).status_code, 400)
        self.assertEqual(self.save(form, vendor=self.vendor.pk, product=second.pk, price=10, stock=3, approved=True).status_code, 200)
        offer = Offer.objects.get(product=second, vendor=self.vendor)
        self.assertFalse(offer.approved)
        self.assertEqual(StockLedger.objects.get(offer=offer).delta, 3)

    def test_vendor_stale_data_and_permission_revocation(self):
        self.client.force_login(self.admin)
        form = self.record('vendors', self.vendor.pk).json()['data']
        self.vendor.title = 'عنوان بیرونی'
        self.vendor.save()
        self.assertEqual(self.save(form, title='بازنویسی').status_code, 409)
        self.client.force_login(self.user)
        self.assertEqual(self.save(form).status_code, 403)

    def test_order_detail_cancel_is_permission_scoped_and_idempotent(self):
        import uuid
        from .models import Cart, Order, OrderItem
        cart = Cart.objects.create(session_key='record-order')
        order = Order.objects.create(cart=cart, idempotency_key=uuid.uuid4(), total=100)
        OrderItem.objects.create(order=order, product=self.product, offer=self.offer, title='رزرو', quantity=1, unit_price=100)
        self.assertEqual(self.record('orders', str(order.pk)).status_code, 403)
        self.user.groups.set([Group.objects.get(name='Order operator')])
        self.client.force_login(self.user)
        detail = self.record('orders', str(order.pk)).json()['data']
        self.assertEqual(len(detail['items']), 1)
        self.assertTrue(detail['can_cancel'])
        for _ in range(2):
            self.assertEqual(self.post({'action': 'cancel_order', 'id': str(order.pk)}).status_code, 200)
        self.offer.refresh_from_db()
        self.assertEqual(self.offer.stock, 5)
        self.assertEqual(StockLedger.objects.count(), 1)
        self.assertEqual(self.record('orders', 'invalid').status_code, 404)

    def test_image_form_validates_file_and_preserves_original(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings
        import tempfile
        self.client.force_login(self.admin)
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            form = self.record('products', self.product.pk).json()['data']
            payload = {**self.fields(form), 'description': 'واقعی', 'action': 'save_record', 'token': form['token']}
            bad = self.client.post('/api/v1/operations/', {**payload, 'image': SimpleUploadedFile('bad.png', b'not-an-image')})
            self.assertEqual(bad.status_code, 400)
            from PIL import Image
            image = io.BytesIO()
            Image.new('RGB', (8, 8), 'silver').save(image, format='PNG')
            good = self.client.post('/api/v1/operations/', {**payload, 'image': SimpleUploadedFile('real.png', image.getvalue(), content_type='image/png')})
            self.assertEqual(good.status_code, 200)
            self.product.refresh_from_db()
            old_name = self.product.image.name
            form = self.record('products', self.product.pk).json()['data']
            self.assertEqual(self.save(form, title='حفظ تصویر').status_code, 200)
            self.product.refresh_from_db()
            self.assertEqual(self.product.image.name, old_name)
