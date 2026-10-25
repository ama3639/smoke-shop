"""Staff operations using the existing role, offer, audit and stock contracts."""
import csv
import io
from functools import wraps
from django.core import signing
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods
from .models import AuditLog, Offer, Order, OrderItem, Product, StockLedger, Vendor
from .services import ShopError
from .views import body, endpoint, ok

COLUMNS = ['offer_id', 'product_sku', 'vendor_slug', 'price', 'stock', 'updated_at']
SALT = 'shop.offer-preview.v1'
SECTIONS = [
    ('offers', 'عرضه و موجودی', 'offer'), ('products', 'کالا و رسانه', 'product'),
    ('vendors', 'فروشندگان', 'vendor'), ('orders', 'سفارش و رزرو', 'order'),
    ('items', 'ردیف‌های سفارش', 'orderitem'), ('stock', 'دفتر موجودی', 'stockledger'),
    ('audit', 'تاریخچه تغییرات', 'auditlog'),
]


def manager(user):
    return user.is_superuser or user.has_perm('shop.manage_marketplace')


def offers_for(user):
    qs = Offer.objects.select_related('product', 'vendor')
    return qs if manager(user) else qs.filter(vendor__members=user, vendor__active=True).distinct()


def permit(user, model, action='view'):
    return user.is_active and user.is_staff and user.has_perm(f'shop.{action}_{model}')


def staff(fn):
    @wraps(fn)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            raise ShopError('AUTH_REQUIRED', 'برای ورود به پنل، وارد حساب شوید.', 401)
        if not request.user.is_active or not request.user.is_staff:
            raise ShopError('FORBIDDEN', 'دسترسی مدیریت برای این حساب فعال نیست.', 403)
        return fn(request, *args, **kwargs)
    return wrapped


def section_data(user, section, query, state):
    model = next((m for key, _, m in SECTIONS if key == section), None)
    if not model or not permit(user, model) or (section == 'vendors' and not manager(user)):
        raise ShopError('FORBIDDEN', 'دسترسی این بخش را ندارید.', 403)
    if section == 'offers':
        qs = offers_for(user)
        if query:
            qs = qs.filter(Q(product__title__icontains=query) | Q(product__sku__icontains=query) | Q(seller_sku__icontains=query))
        if state == 'pending':
            qs = qs.filter(approved=False)
        elif state == 'empty':
            qs = qs.filter(stock=0)
        elif state == 'inactive':
            qs = qs.filter(active=False)
        return qs.order_by('pk'), lambda o: {'id': o.pk, 'title': o.product.title, 'sku': o.product.sku,
            'vendor': o.vendor.title, 'vendor_slug': o.vendor.slug, 'price': o.price, 'stock': o.stock,
            'approved': o.approved, 'active': o.active, 'updated_at': o.updated_at.isoformat(),
            'editable': permit(user, 'offer', 'change')}
    if section == 'products':
        qs = Product.objects.select_related('category').filter(Q(title__icontains=query) | Q(sku__icontains=query))
        return qs.order_by('pk'), lambda o: {'id': o.pk, 'title': o.title, 'sku': o.sku, 'status': o.legal_status,
            'active': o.active, 'url': f'/admin/shop/product/{o.pk}/change/'}
    if section == 'vendors':
        return Vendor.objects.filter(title__icontains=query).order_by('pk'), lambda o: {'id': o.pk, 'title': o.title,
            'status': 'فعال' if o.active else 'غیرفعال', 'url': f'/admin/shop/vendor/{o.pk}/change/'}
    if section == 'orders':
        qs = Order.objects.filter(items__title__icontains=query).distinct() if query else Order.objects.all()
        return qs.order_by('-created_at'), lambda o: {'id': str(o.pk), 'title': str(o.pk), 'status': o.status,
            'total': o.total, 'url': f'/admin/shop/order/{o.pk}/change/'}
    if section == 'items':
        qs = OrderItem.objects.select_related('order', 'offer__vendor').filter(title__icontains=query)
        if not manager(user) and not user.has_perm('shop.view_order'):
            qs = qs.filter(offer__vendor__members=user, offer__vendor__active=True).distinct()
        return qs.order_by('-pk'), lambda o: {'id': o.pk, 'title': o.title, 'vendor': o.seller_name,
            'quantity': o.quantity, 'price': o.unit_price, 'status': o.order.status}
    if section == 'stock':
        qs = StockLedger.objects.select_related('product', 'offer__vendor').filter(product__title__icontains=query)
        if not manager(user) and not user.has_perm('shop.view_order'):
            qs = qs.filter(offer__vendor__members=user, offer__vendor__active=True).distinct()
        return qs.order_by('-pk'), lambda o: {'id': o.pk, 'title': o.product.title, 'delta': o.delta,
            'reason': o.reason, 'created_at': o.created_at.isoformat()}
    return AuditLog.objects.filter(Q(entity__icontains=query) | Q(actor__icontains=query)).order_by('-pk'), lambda o: {
        'id': o.pk, 'title': o.entity, 'status': o.action, 'actor': o.actor, 'created_at': o.created_at.isoformat()}


def export_csv(user):
    if not permit(user, 'offer'):
        raise ShopError('FORBIDDEN', 'دسترسی عرضه ندارید.', 403)
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="offers.csv"'
    response.write('\ufeff')
    writer = csv.writer(response)
    writer.writerow(COLUMNS)
    for o in offers_for(user).order_by('pk').iterator():
        # Prefix text cells; quoting alone does not prevent spreadsheet formulas.
        writer.writerow([o.pk, "'" + o.product.sku, "'" + o.vendor.slug, o.price, o.stock, o.updated_at.isoformat()])
    return response


def preview(user, rows):
    if not isinstance(rows, list) or not 1 <= len(rows) <= 500:
        raise ShopError('INVALID_IMPORT', 'هر بار بین ۱ تا ۵۰۰ ردیف وارد کنید.')
    errors, changes, seen = [], [], set()
    ids = []
    for row in rows:
        try:
            value = int(row.get('offer_id', ''))
            if 0 < value <= 9223372036854775807:
                ids.append(value)
        except (TypeError, ValueError, AttributeError):
            pass
    available = {o.pk: o for o in offers_for(user).filter(pk__in=ids)}
    for line, row in enumerate(rows, 2):
        try:
            oid = str(row['offer_id'])
            if not oid.isascii() or not oid.isdecimal():
                raise ValueError('شناسه عرضه معتبر نیست.')
            o = available.get(int(oid))
            if not o:
                raise ValueError('عرضه یافت نشد یا متعلق به فروشنده شما نیست.')
            if o.pk in seen:
                raise ValueError('عرضه تکراری است.')
            seen.add(o.pk)
            if row['product_sku'] not in (o.product.sku, "'" + o.product.sku) or row['vendor_slug'] not in (o.vendor.slug, "'" + o.vendor.slug):
                raise ValueError('SKU یا فروشنده با عرضه تطبیق ندارد.')
            values = {}
            for name, limit in [('price', 9007199254740991), ('stock', 2147483647)]:
                raw = str(row[name])
                if not raw.isascii() or not raw.isdecimal() or len(raw) > 16 or int(raw) > limit:
                    raise ValueError('قیمت و موجودی باید عدد صحیح نامنفی و در محدوده مجاز باشند.')
                values[name] = int(raw)
            if row['updated_at'] != o.updated_at.isoformat():
                raise ValueError('عرضه تغییر کرده؛ خروجی تازه دریافت کنید.')
            changes.append({'id': o.pk, 'title': o.product.title, 'before_price': o.price, 'before_stock': o.stock,
                            'updated_at': o.updated_at.isoformat(), **values})
        except (KeyError, TypeError, ValueError) as error:
            errors.append({'line': line, 'message': str(error)})
    token = signing.dumps({'user': user.pk, 'changes': changes}, salt=SALT, compress=True) if not errors else None
    return {'changes': changes, 'errors': errors, 'token': token}


def apply_preview(user, token):
    if not isinstance(token, str):
        raise ShopError('INVALID_PREVIEW', 'ابتدا پیش‌نمایش معتبر بسازید.')
    try:
        data = signing.loads(token, salt=SALT, max_age=600)
    except signing.BadSignature:
        raise ShopError('INVALID_PREVIEW', 'پیش‌نمایش منقضی یا نامعتبر است؛ دوباره بررسی کنید.')
    if data['user'] != user.pk:
        raise ShopError('FORBIDDEN', 'پیش‌نمایش متعلق به این حساب نیست.', 403)
    changes = data['changes']
    with transaction.atomic():
        # Match reservation lock order; ledger foreign keys also reference products.
        product_ids = Offer.objects.filter(pk__in=[c['id'] for c in changes]).values('product_id')
        list(Product.objects.select_for_update().filter(pk__in=product_ids).order_by('pk'))
        # Memberships are rechecked after locking.
        locked = {o.pk: o for o in Offer.objects.select_for_update().filter(pk__in=[c['id'] for c in changes]).order_by('pk')}
        allowed = set(offers_for(user).filter(pk__in=locked).values_list('pk', flat=True))
        for c in changes:
            o = locked.get(c['id'])
            if not o or o.pk not in allowed or o.updated_at.isoformat() != c['updated_at']:
                raise ShopError('STALE_PREVIEW', 'داده یا دسترسی تغییر کرده است؛ خروجی تازه بگیرید.', 409)
        for c in changes:
            o = locked[c['id']]
            delta = c['stock'] - o.stock
            o.price, o.stock = c['price'], c['stock']
            o.save(update_fields=['price', 'stock', 'updated_at'])
            AuditLog.objects.create(actor=user.get_username(), action='OFFER_PRICE_STOCK_UPDATE', entity=f'offer:{o.pk}',
                changes={key: {'before': c['before_' + key], 'after': c[key]} for key in ('price', 'stock')})
            if delta:
                StockLedger.objects.create(product_id=o.product_id, offer=o, delta=delta, reason=f'Offer inventory: {user.get_username()}')
    return {'updated': len(changes)}


@never_cache
@require_http_methods(['GET', 'POST'])
@endpoint
@staff
def operations(request):
    user = request.user
    if request.method == 'POST':
        if not permit(user, 'offer', 'change'):
            raise ShopError('FORBIDDEN', 'مجوز تغییر عرضه ندارید.', 403)
        data = body(request)
        if data.get('action') == 'confirm':
            return ok(apply_preview(user, data.get('token')))
        if data.get('action') == 'preview':
            text = data.get('csv', '')
            if not isinstance(text, str) or len(text) > 1000000:
                raise ShopError('INVALID_IMPORT', 'فایل CSV معتبر نیست یا بزرگ‌تر از حد مجاز است.')
            try:
                reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')), strict=True)
                if reader.fieldnames != COLUMNS:
                    raise ShopError('INVALID_IMPORT', 'ستون‌ها باید دقیقاً مطابق خروجی نمونه باشند.')
                rows = []
                for row in reader:
                    if len(rows) >= 500 or None in row or any(v is None for v in row.values()):
                        raise ShopError('INVALID_IMPORT', 'ساختار یا تعداد ردیف‌ها معتبر نیست.')
                    rows.append(row)
            except csv.Error:
                raise ShopError('INVALID_IMPORT', 'ساختار CSV معتبر نیست.')
            return ok(preview(user, rows))
        if data.get('action') == 'edit':
            return ok(preview(user, [data.get('row')]))
        raise ShopError('INVALID_ACTION', 'عملیات معتبر نیست.')
    if request.GET.get('export') == 'csv':
        return export_csv(user)
    sections = [{'key': key, 'title': title} for key, title, model in SECTIONS
                if permit(user, model) and (key != 'vendors' or manager(user))]
    if not sections:
        raise ShopError('FORBIDDEN', 'نقش عملیاتی به این حساب تخصیص داده نشده است.', 403)
    section = request.GET.get('section', sections[0]['key'])
    qs, serialize = section_data(user, section, request.GET.get('q', '')[:100], request.GET.get('state', ''))
    try:
        page = int(request.GET.get('page', '1'))
        if not 1 <= page <= 2147483647:
            raise ValueError
    except ValueError:
        raise ShopError('INVALID_PAGE', 'شماره صفحه معتبر نیست.')
    total = qs.count()
    stats = {}
    for entry in sections:
        rows, _ = section_data(user, entry['key'], '', '')
        stats[entry['title']] = rows.count()
    return ok({'sections': sections, 'section': section, 'stats': stats,
        'rows': [serialize(o) for o in qs[(page - 1) * 30:page * 30]],
        'page': page, 'has_next': page * 30 < total, 'total': total,
        'can_edit_offers': permit(user, 'offer', 'change')})
