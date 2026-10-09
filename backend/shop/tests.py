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
        self.assertEqual(Product.objects.filter(sku__startswith='DEMO-').count(), 6)
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
        self.assertEqual(len(all_cigarettes), 6)
        self.assertTrue(all(p['brand'] == 'Winston' and not p['purchasable'] for p in all_cigarettes))
        self.assertEqual(len(self.client.get(endpoint, {'type': 'cigarette', 'mode': 'wholesale'}).json()['data']), 5)
        self.assertEqual(len(self.client.get(endpoint, {'type': 'cigarette', 'mode': 'retail'}).json()['data']), 5)
        self.assertEqual(len(self.client.get(endpoint, {'type': 'cigarette', 'q': 'كامپكت'}).json()['data']), 2)
        self.assertEqual(len(self.client.get(endpoint, {'type': 'cigarette', 'brand': 'Winston'}).json()['data']), 6)
        categories = self.client.get('/api/v1/catalog/', {'type': 'cigarette'}).json()['data']['categories']
        self.assertEqual({c['slug'] for c in categories}, {'regular', 'slim', 'compact'})

    def test_product_default_new_fields_and_health(self):
        self.assertEqual(self.client.get('/api/v1/health/').json()['data']['status'], 'ok')

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
