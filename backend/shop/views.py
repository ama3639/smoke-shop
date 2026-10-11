import json
import uuid
from functools import wraps
from django.db import transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_http_methods
from .models import Branch, Cart, CartItem, Category, Device, FeatureFlag, Order, Product, normalize
from .serializers import ProductSerializer
from .services import ShopError, check_purchase, checkout


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
    return Product.objects.filter(active=True, legal_status__in=['APPROVED_ONLINE', 'CATALOG_ONLY', 'IN_PERSON_ONLY']).select_related('category').prefetch_related('compatibility__device')


def current_cart(request):
    if not request.session.session_key:
        request.session.create()
    return Cart.objects.get_or_create(session_key=request.session.session_key)[0]


@require_http_methods(['GET'])
def health(request):
    Category.objects.exists()
    return ok({'status': 'ok'})


@require_http_methods(['GET', 'POST'])
@endpoint
def session(request):
    if request.method == 'POST':
        data = body(request)
        request.session['adult'] = data.get('adult') is True
    return ok({'csrf_token': get_token(request), 'adult': request.session.get('adult', False)})


@require_http_methods(['GET'])
def catalog(request):
    categories = Category.objects.all()
    if request.GET.get('type'):
        categories = categories.filter(product__product_type=request.GET['type']).distinct()
    return ok({'categories': list(categories.values('title', 'slug')),
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
    if request.GET.get('mode') == 'wholesale':
        qs = qs.filter(wholesale_available=True)
    elif request.GET.get('mode') == 'retail':
        qs = qs.filter(retail_available=True)
    if request.GET.get('q'):
        qs = qs.filter(search_text__contains=normalize(request.GET['q'][:100]))
    if request.GET.get('category'):
        qs = qs.filter(category__slug=request.GET['category'])
    if request.GET.get('device'):
        qs = qs.filter(compatibility__device__slug=request.GET['device'], compatibility__is_incompatible=False)
    if request.GET.get('available') == '1':
        qs = qs.filter(stock__gt=0)
    return ok(ProductSerializer(qs[:100], many=True).data)


@require_http_methods(['GET'])
@endpoint
def product(request, slug):
    obj = visible_products().filter(slug=slug).first()
    if not obj:
        raise ShopError('NOT_FOUND', 'کالا پیدا نشد.', 404)
    return ok(ProductSerializer(obj).data)


@require_http_methods(['GET', 'POST', 'DELETE'])
@endpoint
def cart(request):
    cart_obj = current_cart(request)
    if request.method != 'GET':
        data = body(request)
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
                check_purchase(obj)
                if quantity > obj.stock:
                    raise ShopError('OUT_OF_STOCK', 'موجودی کافی نیست.', 409)
                CartItem.objects.update_or_create(cart=cart_obj, product=obj, defaults={'quantity': quantity})
    cart_obj.items.filter(product__legal_status__in=['CATALOG_ONLY', 'IN_PERSON_ONLY', 'REVIEW_REQUIRED', 'BLOCKED']).delete()
    cart_obj.items.filter(product__active=False).delete()
    items = list(cart_obj.items.select_related('product__category').prefetch_related('product__compatibility__device'))
    latest_order = Order.objects.filter(cart=cart_obj).order_by('-created_at').first()
    return ok({'items': [{'product': ProductSerializer(i.product).data, 'quantity': i.quantity} for i in items],
               'total': sum(i.product.price * i.quantity for i in items),
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
    obj = Order.objects.filter(pk=pk, cart__session_key=request.session.session_key).first()
    if not obj:
        raise ShopError('NOT_FOUND', 'سفارش پیدا نشد.', 404)
    return ok({'id': str(obj.pk), 'total': obj.total, 'status': obj.status,
               'items': list(obj.items.values('title', 'quantity', 'unit_price'))})
