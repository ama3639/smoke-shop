import json
import uuid
from functools import wraps
from django.db import transaction
from django.db.models import Q, Max
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_http_methods
from .models import Branch, Cart, CartItem, Device, FeatureFlag, Offer, Order, Product, Vendor, Category, normalize
from .serializers import ProductSerializer
from .services import ShopError, can_purchase_offer, check_purchase, checkout


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
    visible = visible_products()
    if request.GET.get('type'):
        visible = visible.filter(product_type=request.GET['type'])
    categories = Category.objects.filter(pk__in=visible.values('category_id')).order_by('title')
    vendor_ids = Offer.objects.filter(product__in=visible, active=True, approved=True, vendor__active=True).values('vendor_id')
    return ok({'categories': list(categories.values('title', 'slug')),
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
    obj = Order.objects.filter(pk=pk, cart__session_key=request.session.session_key).first()
    if not obj:
        raise ShopError('NOT_FOUND', 'سفارش پیدا نشد.', 404)
    return ok({'id': str(obj.pk), 'total': obj.total, 'status': obj.status,
               'expires_at': obj.expires_at,
               'items': list(obj.items.values('title', 'quantity', 'unit_price', 'seller_name'))})
