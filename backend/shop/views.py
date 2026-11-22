import json
from decimal import Decimal, InvalidOperation
import uuid
import hashlib
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from functools import wraps
from django.db import transaction
from django.db.models import Q, Max
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_http_methods
from django.views.decorators.cache import never_cache
from .models import Branch, Cart, CartItem, Device, FeatureFlag, Offer, Order, Product, Vendor, Category, normalize, SiteSettings, SupplyRequest, AuditLog
from .serializers import ProductSerializer
from .services import ShopError, can_purchase, can_purchase_offer, check_purchase, checkout


def ok(data, status=200):
    return JsonResponse({'success': True, 'data': data}, status=status)


def endpoint(fn):
    @wraps(fn)
    def wrapped(request, *args, **kwargs):
        try:
            return fn(request, *args, **kwargs)
        except ShopError as e:
            return JsonResponse({'success': False, 'error': {'code': e.code, 'message': e.message}}, status=e.status)
    return wrapped


def body(request):
    try:
        data = json.loads(request.body or '{}')
        if not isinstance(data, dict):
            raise ValueError
        return data
    except (ValueError, UnicodeDecodeError):
        raise ShopError('INVALID_BODY', 'اطلاعات درخواست معتبر نیست.')


def visible_products():
    return Product.objects.filter(active=True, legal_status__in=['APPROVED_ONLINE', 'CATALOG_ONLY', 'IN_PERSON_ONLY']).select_related('category').prefetch_related('compatibility__device', 'offers__vendor')


def serialize_products(products):
    return ProductSerializer(products, many=True, context={'cart_enabled': FeatureFlag.enabled('cart')}).data


def current_cart(request):
    owner = request.user if request.user.is_authenticated else None
    if not request.session.session_key:
        request.session.create()
    cart = Cart.objects.get_or_create(session_key=request.session.session_key, defaults={'user': owner})[0]
    if cart.user_id is not None and cart.user_id != (owner.pk if owner else None):
        request.session.cycle_key()
        return Cart.objects.create(session_key=request.session.session_key, user=owner)
    if owner and cart.user_id is None:
        cart.user = owner
        cart.save(update_fields=['user'])
    return cart


def account_response(request):
    if not request.user.is_authenticated:
        return ok({'authenticated': False, 'orders': []})
    try:
        page = int(request.GET.get('order_page', '1'))
        if page < 1:
            raise ValueError
    except ValueError:
        raise ShopError('INVALID_PAGE', 'صفحه درخواست‌ها معتبر نیست.')
    orders = Order.objects.filter(cart__user=request.user).order_by('-created_at')
    paginator = Paginator(orders, 20)
    return ok({'authenticated': True,
               'user': {'username': request.user.username, 'name': request.user.first_name, 'email': request.user.email},
               'orders': list(orders[(page - 1) * 20:page * 20].values('id', 'total', 'status', 'created_at')),
               'supply_requests': list(SupplyRequest.objects.filter(user=request.user).order_by('-pk')[:30].values('id', 'product__title', 'quantity', 'status', 'review_note')),
               'pagination': {'page': page, 'pages': paginator.num_pages, 'total': paginator.count, 'has_next': page < paginator.num_pages}})


def claim_guest_cart(request, old_key):
    # Keep the cart ID, offer rows and historical reservations across Django's session rotation.
    if not old_key:
        return
    with transaction.atomic():
        previous = Cart.objects.select_for_update().filter(session_key=old_key).filter(Q(user__isnull=True) | Q(user=request.user)).first()
        if previous:
            previous.session_key = request.session.session_key
            previous.user = request.user
            previous.save(update_fields=['session_key', 'user'])


def throttle_account(request, action, username):
    identity = request.META.get('REMOTE_ADDR', '') + '|' + username.casefold()
    key = 'account:' + action + ':' + hashlib.sha256(identity.encode()).hexdigest()
    cache.add(key, 0, timeout=600)
    try:
        attempts = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=600)
        attempts = 1
    if attempts > (5 if action == 'register' else 10):
        raise ShopError('RATE_LIMITED', 'تعداد تلاش‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.', 429)
    return key


def profile_values(data):
    name, email = data.get('name', ''), data.get('email', '')
    if not isinstance(name, str) or len(name) > 150 or not isinstance(email, str) or len(email) > 254:
        raise ShopError('INVALID_PROFILE', 'مشخصات حساب معتبر نیست.')
    name, email = name.strip(), email.strip()
    try:
        if email:
            validate_email(email)
    except ValidationError:
        raise ShopError('INVALID_EMAIL', 'ایمیل معتبر وارد کنید.')
    return name, email


@require_http_methods(['GET', 'POST'])
@endpoint
def account(request):
    if request.method == 'GET':
        return account_response(request)
    data = body(request)
    action = data.get('action')
    if action == 'logout':
        logout(request)
        return account_response(request)
    if action == 'update':
        if not request.user.is_authenticated:
            raise ShopError('LOGIN_REQUIRED', 'ابتدا وارد حساب شوید.', 403)
        request.user.first_name, request.user.email = profile_values(data)
        request.user.save(update_fields=['first_name', 'email'])
        return account_response(request)
    if action not in ('login', 'register'):
        raise ShopError('INVALID_ACTION', 'عملیات حساب معتبر نیست.')
    if request.user.is_authenticated:
        raise ShopError('ALREADY_SIGNED_IN', 'برای ورود به حساب دیگر ابتدا خارج شوید.')
    username, password = data.get('username', ''), data.get('password', '')
    if not isinstance(username, str) or not (3 if action == 'register' else 1) <= len(username) <= 150 or not isinstance(password, str) or not 1 <= len(password) <= 128:
        raise ShopError('INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور معتبر نیست.')
    username = get_user_model().normalize_username(username.strip())
    throttle_key = throttle_account(request, action, '' if action == 'register' else username)
    old_key = request.session.session_key
    if action == 'register':
        if data.get('adult') is not True:
            raise ShopError('AGE_REQUIRED', 'تأیید ۱۸ سال برای ثبت‌نام لازم است.', 403)
        form = UserCreationForm({'username': username, 'password1': password, 'password2': data.get('confirm', '')})
        if not form.is_valid():
            raise ShopError('INVALID_REGISTRATION', ' '.join(str(message) for errors in form.errors.values() for message in errors))
        name, email = profile_values(data)
        user = form.save(commit=False)
        user.first_name, user.email = name, email
        user.save()
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        request.session['adult'] = True
    else:
        user = authenticate(request, username=username, password=password)
        if user is None:
            raise ShopError('INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور صحیح نیست.', 403)
        login(request, user)
        cache.delete(throttle_key)
    claim_guest_cart(request, old_key)
    return account_response(request)


@require_http_methods(['GET'])
def health(request):
    Category.objects.exists()
    return ok({'status': 'ok'})


@never_cache
@require_http_methods(['GET'])
def site_settings(request):
    value = SiteSettings.objects.filter(pk=1).values('display_name', 'support_phone', 'support_email').first()
    return ok(value or {'display_name': 'اسموک‌شاپ', 'support_phone': '', 'support_email': ''})


@never_cache
@require_http_methods(['POST'])
@endpoint
def supply_request(request):
    if not request.user.is_authenticated or not request.user.is_active:
        raise ShopError('AUTH_REQUIRED', 'برای درخواست تأمین، ابتدا وارد حساب شوید.', 401)
    data = body(request)
    pid, quantity = data.get('product_id'), data.get('quantity')
    if type(pid) is not int or not 1 <= pid <= 9223372036854775807 or type(quantity) is not int or not 1 <= quantity <= 20:
        raise ShopError('INVALID_QUANTITY', 'شناسه کالا و تعداد ۱ تا ۲۰ معتبر لازم است.')
    with transaction.atomic():
        # Same product-first order as inventory operations; this request never reserves stock.
        p = Product.objects.select_for_update().select_related('category').filter(pk=pid).first()
        if not p or not can_purchase(p):
            raise ShopError('LEGAL_STATUS_BLOCKED', 'درخواست تأمین این کالا فعال نیست.', 403)
        offers = list(p.offers.select_related('vendor'))
        available = sum(o.stock for o in offers if o.active and o.approved and o.vendor.active) if offers else p.stock
        if available:
            raise ShopError('IN_STOCK', 'موجودی ثبت شده است؛ صفحه را تازه‌سازی کنید.', 409)
        throttle_account(request, 'supply-request', str(request.user.pk))
        item, created = SupplyRequest.objects.get_or_create(user=request.user, product=p, status='PENDING', defaults={'quantity': quantity})
        if created:
            AuditLog.objects.create(actor=request.user.get_username(), action='SUPPLY_REQUESTED', entity=f'supplyrequest:{item.pk}')
    return ok({'id': item.pk, 'status': item.status, 'quantity': item.quantity, 'payment_required': False})


@require_http_methods(['GET', 'POST'])
@endpoint
def session(request):
    if request.method == 'POST':
        data = body(request)
        request.session['adult'] = data.get('adult') is True
    return ok({'csrf_token': get_token(request), 'adult': request.session.get('adult', False)})


@require_http_methods(['GET'])
def catalog(request):
    visible = visible_products()
    if request.GET.get('type'):
        visible = visible.filter(product_type=request.GET['type'])
    categories = Category.objects.filter(pk__in=visible.values('category_id')).order_by('title')
    vendor_ids = Offer.objects.filter(product__in=visible, active=True, approved=True, vendor__active=True).values('vendor_id')
    return ok({'categories': list(categories.values('title', 'slug')),
               'flavors': list(visible.filter(product_type='tobacco').exclude(flavor='').order_by('flavor').values_list('flavor', flat=True).distinct()),
               'weights': [str(w) for w in visible.filter(product_type='tobacco', weight_grams__gt=0).order_by('weight_grams').values_list('weight_grams', flat=True).distinct()],
               'brands': list(visible.exclude(brand='').order_by('brand').values_list('brand', flat=True).distinct()),
               'types': [{'value': value, 'title': title} for value, title in Product._meta.get_field('product_type').choices],
               'vendors': list(Vendor.objects.filter(pk__in=vendor_ids).order_by('title').values('title', 'slug')),
               'total': visible.count(), 'updated_at': visible.aggregate(value=Max('updated_at'))['value'],
               'devices': list(Device.objects.values('title', 'slug')),
               'checkout_enabled': FeatureFlag.enabled('order_requests')})


@require_http_methods(['GET'])
def branches(request):
    return ok(list(Branch.objects.filter(active=True).values('id', 'title', 'city', 'address', 'phone', 'hours')))


@require_http_methods(['GET'])
def products(request):
    qs = visible_products().order_by('pk')
    if request.GET.get('type'):
        qs = qs.filter(product_type=request.GET['type'])
        if request.GET['type'] == 'cigarette':
            # Stable photo order in both fresh and upgraded catalogs; retain product IDs.
            qs = qs.order_by('catalog_image', 'pk')
    if request.GET.get('brand'):
        qs = qs.filter(brand=request.GET['brand'][:100])
    if request.GET.get('flavor'):
        qs = qs.filter(product_type='tobacco', flavor=request.GET['flavor'][:100])
    if request.GET.get('weight'):
        try:
            weight = Decimal(request.GET['weight'][:100])
            if not weight.is_finite() or not Decimal('0.01') <= weight <= Decimal('999999.99') or weight.as_tuple().exponent < -2:
                raise ValueError
        except (InvalidOperation, ValueError):
            return JsonResponse({'success': False, 'error': {'code': 'INVALID_WEIGHT', 'message': 'وزن باید عدد مثبت با حداکثر دو رقم اعشار باشد.'}}, status=400)
        qs = qs.filter(product_type='tobacco', weight_grams=weight)
    offer_filter = {'active': True, 'approved': True, 'vendor__active': True}
    if request.GET.get('vendor'):
        offer_filter['vendor__slug'] = request.GET['vendor']
    mode = request.GET.get('mode')
    if mode in ('retail', 'wholesale'):
        field = f'{mode}_available'
        offer_filter[field] = True
        if not request.GET.get('vendor'):
            public_offer_ids = Offer.objects.filter(**offer_filter).values('product_id')
            qs = qs.filter(Q(pk__in=public_offer_ids) | Q(offers__isnull=True, **{field: True}))
    if request.GET.get('vendor'):
        qs = qs.filter(pk__in=Offer.objects.filter(**offer_filter).values('product_id'))
    if request.GET.get('q'):
        qs = qs.filter(search_text__contains=normalize(request.GET['q'][:100]))
    if request.GET.get('category'):
        qs = qs.filter(category__slug=request.GET['category'])
    if request.GET.get('device'):
        qs = qs.filter(compatibility__device__slug=request.GET['device'], compatibility__is_incompatible=False)
    if request.GET.get('available') == '1':
        offer_ids = Offer.objects.filter(**offer_filter, stock__gt=0).values('product_id')
        qs = qs.filter(Q(pk__in=offer_ids) | Q(offers__isnull=True, stock__gt=0))
    qs = qs.distinct()
    try:
        page = int(request.GET.get('page', '1'))
        size = int(request.GET.get('page_size', '100'))
        if page < 1 or not 1 <= size <= 100:
            raise ValueError
    except ValueError:
        return JsonResponse({'success': False, 'error': {'code': 'INVALID_PAGE', 'message': 'صفحه یا اندازه صفحه معتبر نیست.'}}, status=400)
    paginator = Paginator(qs, size)
    items = serialize_products(qs[(page - 1) * size:page * size])
    meta = {'total': paginator.count, 'page': page, 'page_size': size,
            'pages': paginator.num_pages, 'has_next': page < paginator.num_pages}
    if request.GET.get('pagination') == '1':
        return ok({'items': items, **meta})
    return JsonResponse({'success': True, 'data': items, 'meta': meta})


@require_http_methods(['GET'])
@endpoint
def product(request, slug):
    obj = visible_products().filter(slug=slug).first()
    if not obj:
        raise ShopError('NOT_FOUND', 'کالا پیدا نشد.', 404)
    return ok(ProductSerializer(obj, context={'cart_enabled': FeatureFlag.enabled('cart')}).data)


@require_http_methods(['GET'])
def vendors(request):
    return ok(list(Vendor.objects.filter(active=True).order_by('title').values('title', 'slug', 'city', 'address', 'phone', 'description')))


@require_http_methods(['GET', 'POST', 'DELETE'])
@endpoint
def cart(request):
    # Header reads must not allocate competing anonymous session cookies while
    # the age-consent POST is creating the browser's first session.
    if request.method == 'GET':
        request.session.get('adult', False)  # Load and discard an expired cookie before inspecting its key.
    if request.method == 'GET' and not request.session.session_key:
        return ok({'items': [], 'total': 0, 'checkout_enabled': FeatureFlag.enabled('order_requests'),
                   'latest_order_id': None})
    cart_obj = current_cart(request)
    if request.method != 'GET':
        data = body(request)
        if request.method == 'DELETE' and 'item_id' in data:
            item_id = data['item_id']
            if type(item_id) is not int or item_id <= 0:
                raise ShopError('INVALID_ITEM', 'ردیف سبد معتبر نیست.')
            with transaction.atomic():
                Cart.objects.select_for_update().get(pk=cart_obj.pk)
                CartItem.objects.filter(cart=cart_obj, pk=item_id).delete()
            return cart_response(cart_obj)
        pid = data.get('product_id')
        if type(pid) is not int or pid <= 0:
            raise ShopError('INVALID_PRODUCT', 'کالا معتبر نیست.')
        with transaction.atomic():
            Cart.objects.select_for_update().get(pk=cart_obj.pk)
            if request.method == 'DELETE':
                CartItem.objects.filter(cart=cart_obj, product_id=pid).delete()
            else:
                if not request.session.get('adult', False):
                    raise ShopError('AGE_REQUIRED', 'برای استفاده از سبد، تأیید ۱۸ سال لازم است.', 403)
                quantity = data.get('quantity', 1)
                if type(quantity) is not int or not 1 <= quantity <= 20:
                    raise ShopError('INVALID_QUANTITY', 'تعداد باید بین ۱ تا ۲۰ باشد.')
                obj = Product.objects.select_related('category').filter(pk=pid).first()
                if not obj:
                    raise ShopError('NOT_FOUND', 'کالا پیدا نشد.', 404)
                offer = None
                if data.get('offer_id') is not None:
                    offer_id = data['offer_id']
                    if type(offer_id) is not int or offer_id <= 0:
                        raise ShopError('INVALID_OFFER', 'فروشنده معتبر نیست.')
                    offer = Offer.objects.select_related('vendor').filter(pk=offer_id, product=obj).first()
                    if not offer:
                        raise ShopError('NOT_FOUND', 'عرضه پیدا نشد.', 404)
                elif obj.offers.exists():
                    raise ShopError('SELLER_REQUIRED', 'فروشنده کالا را انتخاب کنید.', 409)
                check_purchase(obj, offer)
                if quantity > (offer.stock if offer else obj.stock):
                    raise ShopError('OUT_OF_STOCK', 'موجودی کافی نیست.', 409)
                CartItem.objects.update_or_create(cart=cart_obj, product=obj, offer=offer, defaults={'quantity': quantity})
    return cart_response(cart_obj)


def cart_response(cart_obj):
    cart_obj.items.filter(product__legal_status__in=['CATALOG_ONLY', 'IN_PERSON_ONLY', 'REVIEW_REQUIRED', 'BLOCKED']).delete()
    cart_obj.items.filter(product__active=False).delete()
    items = list(cart_obj.items.select_related('product__category', 'offer__vendor').prefetch_related('product__compatibility__device', 'product__offers__vendor'))
    enabled = FeatureFlag.enabled('cart')
    rows = []
    for item in items:
        product_data = ProductSerializer(item.product, context={'cart_enabled': enabled}).data
        if item.offer:
            item.offer.product = item.product
            product_data['price'] = item.offer.price if can_purchase_offer(item.offer, enabled) else None
            product_data['stock'] = item.offer.stock
            product_data['purchasable'] = can_purchase_offer(item.offer, enabled)
        elif item.product.offers.all():
            product_data['purchasable'] = False
            product_data['price'] = None
        rows.append({'id': item.pk, 'product': product_data, 'quantity': item.quantity,
                     'offer_id': item.offer_id, 'seller_name': item.offer.vendor.title if item.offer else ''})
    latest_order = Order.objects.filter(cart=cart_obj).order_by('-created_at').first()
    return ok({'items': rows,
               'total': sum((i.offer.price if i.offer else i.product.price) * i.quantity for i in items),
               'checkout_enabled': FeatureFlag.enabled('order_requests'),
               'latest_order_id': str(latest_order.pk) if latest_order else None})


@require_http_methods(['POST'])
@endpoint
def order_create(request):
    if not request.session.get('adult', False):
        raise ShopError('AGE_REQUIRED', 'تأیید سن لازم است.', 403)
    try:
        key = uuid.UUID(str(body(request).get('idempotency_key', '')))
    except ValueError:
        raise ShopError('INVALID_KEY', 'شناسه درخواست معتبر نیست.')
    order = checkout(current_cart(request), key)
    return ok({'id': str(order.pk), 'total': order.total, 'status': order.status}, 201)


@require_http_methods(['GET'])
@endpoint
def order_detail(request, pk):
    allowed = Q(cart__user__isnull=True, cart__session_key=request.session.session_key)
    if request.user.is_authenticated:
        allowed |= Q(cart__user=request.user)
    obj = Order.objects.filter(allowed, pk=pk).first()
    if not obj:
        raise ShopError('NOT_FOUND', 'سفارش پیدا نشد.', 404)
    return ok({'id': str(obj.pk), 'total': obj.total, 'status': obj.status,
               'expires_at': obj.expires_at,
               'items': list(obj.items.values('title', 'quantity', 'unit_price', 'seller_name'))})

