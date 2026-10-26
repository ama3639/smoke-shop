"""Staff operations using the existing role, offer, audit and stock contracts."""
import csv
import io
import hashlib
from django import forms
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator
from django.db import IntegrityError
from django.forms import modelform_factory
from functools import wraps
from django.core import signing
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods
from .models import AuditLog, Offer, Order, OrderItem, Product, StockLedger, Vendor, Category
from .services import ShopError, cancel_reservation
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



# Explicit allowlists keep financial/legal policy and account privileges out of daily forms.
RECORD_FIELDS = {
    'products': (Product, ['title', 'slug', 'sku', 'category', 'product_type', 'brand',
        'description', 'material', 'dimensions', 'flavor', 'weight_grams',
        'sticks_per_pack', 'packs_per_carton', 'manufacturer', 'source_url',
        'source_checked_on', 'specification_notes', 'image', 'catalog_image',
        'illustration', 'retail_available', 'wholesale_available', 'active']),
    'vendors': (Vendor, ['title', 'slug', 'city', 'address', 'phone', 'description', 'active']),
    'offers': (Offer, ['vendor', 'product', 'seller_sku', 'retail_available',
        'wholesale_available', 'active']),
}
RECORD_SALT = 'shop.operations-record.v1'


def record_form(user, section, record_id, data=None, files=None, lock=False):
    if section not in RECORD_FIELDS:
        raise ShopError('INVALID_SECTION', 'این بخش فرم ویرایش ندارد.')
    model, fields = RECORD_FIELDS[section]
    creating = record_id == 'new'
    if not permit(user, model._meta.model_name, 'add' if creating else 'change') or (section == 'vendors' and not manager(user)):
        raise ShopError('FORBIDDEN', 'مجوز ثبت یا تغییر این بخش را ندارید.', 403)
    instance = None
    if not creating:
        if not str(record_id).isascii() or not str(record_id).isdecimal() or len(str(record_id)) > 18:
            raise ShopError('NOT_FOUND', 'شناسه رکورد معتبر نیست.', 404)
        qs = offers_for(user) if section == 'offers' else model.objects.all()
        if lock:
            # Do not join nullable relations under FOR UPDATE; match checkout lock ordering.
            if section == 'offers':
                product_id = qs.filter(pk=record_id).values_list('product_id', flat=True).first()
                list(Product.objects.select_for_update().filter(pk=product_id))
                qs = Offer.objects.filter(pk__in=qs.values('pk'))
            qs = qs.select_for_update()
        try:
            instance = qs.get(pk=record_id)
        except (model.DoesNotExist, ValueError, TypeError):
            raise ShopError('NOT_FOUND', 'رکورد یافت نشد یا دسترسی ندارید.', 404)
    fields = list(fields)
    if section == 'offers' and manager(user):
        fields.append('approved')
    if section == 'offers' and creating:
        fields += ['price', 'stock']
    form = modelform_factory(model, fields=fields)(data=data, files=files, instance=instance)
    if section == 'offers' and creating:
        form.fields['price'].max_value = 9007199254740991
        form.fields['price'].validators.append(MaxValueValidator(9007199254740991))
    for key, label in {'slug': 'شناسه مسیر', 'sku': 'شناسه کالا (SKU)', 'category': 'دسته کالا'}.items():
        if key in form.fields:
            form.fields[key].label = label
    if section == 'products':
        form.fields['category'].queryset = Category.objects.order_by('title')
    if instance:
        for name in (['vendor', 'product'] if section == 'offers' else ['slug', 'sku']):
            if name in form.fields:
                form.fields[name].disabled = True
    if section == 'offers' and not manager(user):
        form.fields['vendor'].queryset = Vendor.objects.filter(members=user, active=True)
        form.fields['product'].queryset = Product.objects.filter(active=True,
            legal_status__in=['APPROVED_ONLINE', 'CATALOG_ONLY', 'IN_PERSON_ONLY'])
        # Existing hidden/unlisted products must remain editable without changing their identity.
        if instance:
            form.fields['product'].queryset = Product.objects.filter(pk=instance.product_id)
    return form


def record_version(instance):
    if not instance or not instance.pk:
        return 'new'
    values = [str(getattr(instance, field.attname)) for field in instance._meta.concrete_fields]
    return hashlib.sha256(repr(values).encode()).hexdigest()


def describe_record(user, section, record_id):
    form = record_form(user, section, record_id)
    fields = []
    for name, field in form.fields.items():
        value = form[name].value()
        kind = ('file' if isinstance(field, forms.FileField) else
                'boolean' if isinstance(field, forms.BooleanField) else
                'select' if hasattr(field, 'choices') else
                'textarea' if isinstance(field.widget, forms.Textarea) else
                'number' if isinstance(field, (forms.IntegerField, forms.DecimalField)) else
                'date' if isinstance(field, forms.DateField) else 'text')
        options = [[str(k), str(v)] for k, v in field.choices] if hasattr(field, 'choices') else []
        fields.append({'name': name, 'label': str(field.label or name), 'kind': kind,
            'required': field.required, 'disabled': field.disabled, 'help': str(field.help_text),
            'value': bool(value) if kind == 'boolean' else str(value or ''), 'options': options,
            'max_length': getattr(field, 'max_length', None)})
    return {'section': section, 'record_id': record_id, 'fields': fields,
        'token': signing.dumps({'user': user.pk, 'section': section, 'id': record_id,
            'version': record_version(form.instance)}, salt=RECORD_SALT)}


def save_record(user, data, files):
    try:
        signed = signing.loads(data.get('token', ''), salt=RECORD_SALT, max_age=1800)
    except (signing.BadSignature, TypeError):
        raise ShopError('INVALID_FORM', 'فرم منقضی یا نامعتبر است؛ دوباره باز کنید.')
    if signed['user'] != user.pk:
        raise ShopError('FORBIDDEN', 'فرم متعلق به این حساب نیست.', 403)
    section, rid = signed['section'], signed['id']
    try:
        with transaction.atomic():
            form = record_form(user, section, rid, data=data, files=files, lock=True)
            if record_version(form.instance) != signed['version']:
                raise ShopError('STALE_RECORD', 'رکورد تغییر کرده است؛ فرم را دوباره باز کنید.', 409)
            if not form.is_valid():
                errors = '؛ '.join(f'{form.fields[k].label if k in form.fields else "فرم"}: {"، ".join(v)}' for k, v in form.errors.items())
                raise ShopError('INVALID_RECORD', errors)
            old = {name: str(form[name].initial or '') for name in form.changed_data}
            if section == 'offers' and rid == 'new':
                Product.objects.select_for_update().get(pk=form.cleaned_data['product'].pk)
            obj = form.save()
            AuditLog.objects.create(actor=user.get_username(), action='OPERATIONS_CREATE' if rid == 'new' else 'OPERATIONS_UPDATE',
                entity=f'{obj._meta.model_name}:{obj.pk}', changes={name: {'before': old[name],
                    'after': str(getattr(obj, name))} for name in form.changed_data})
            if section == 'offers' and rid == 'new' and obj.stock:
                StockLedger.objects.create(product=obj.product, offer=obj, delta=obj.stock,
                    reason=f'Offer inventory: {user.get_username()}')
    except IntegrityError:
        raise ShopError('RECORD_CONFLICT', 'شناسه یا عرضه تکراری است؛ داده را بازبینی کنید.', 409)
    return {'id': obj.pk}


def order_detail(user, record_id):
    if not permit(user, 'order'):
        raise ShopError('FORBIDDEN', 'مجوز مشاهده سفارش ندارید.', 403)
    try:
        order = Order.objects.get(pk=record_id)
    except (Order.DoesNotExist, ValueError, ValidationError):
        raise ShopError('NOT_FOUND', 'سفارش یافت نشد.', 404)
    return {'id': str(order.pk), 'status': order.status, 'total': order.total,
        'created_at': order.created_at, 'expires_at': order.expires_at,
        'can_cancel': user.has_perm('shop.cancel_order') and order.status == 'PENDING_REVIEW',
        'items': list(order.items.values('title', 'seller_name', 'quantity', 'unit_price'))}


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
        data = request.POST if request.content_type == 'multipart/form-data' else body(request)
        if data.get('action') == 'save_record':
            return ok(save_record(user, data, request.FILES))
        if data.get('action') == 'cancel_order':
            if not user.has_perm('shop.cancel_order'):
                raise ShopError('FORBIDDEN', 'مجوز لغو رزرو ندارید.', 403)
            detail = order_detail(user, data.get('id'))
            return ok({'cancelled': cancel_reservation(detail['id'], actor=user.get_username())})
        if not permit(user, 'offer', 'change'):
            raise ShopError('FORBIDDEN', 'مجوز تغییر عرضه ندارید.', 403)
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
    if 'record' in request.GET:
        section, rid = request.GET.get('section'), request.GET['record']
        return ok(order_detail(user, rid) if section == 'orders' else describe_record(user, section, rid))
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
        'can_edit_offers': permit(user, 'offer', 'change'),
        'can_create': section in RECORD_FIELDS and permit(user, dict((k, m) for k, _, m in SECTIONS)[section], 'add')
            and (section != 'vendors' or manager(user)),
        'can_change': section in RECORD_FIELDS and permit(user, dict((k, m) for k, _, m in SECTIONS)[section], 'change')
            and (section != 'vendors' or manager(user))})

