"""Private supplier applications and reference lists; no automatic price publication."""
import re
from pathlib import PurePath
from django import forms
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import HttpResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods
from .models import AuditLog, SupplierProfile, SupplierSubmission
from .services import ShopError
from .tabular import read_table, LIMIT
from .views import body, endpoint, ok, throttle_account

QUOTE_COLUMNS = ['product_sku', 'purchase_price', 'stock']


class SupplierForm(forms.ModelForm):
    class Meta:
        model = SupplierProfile
        fields = ['title', 'phone']

    def clean_phone(self):
        value = self.cleaned_data['phone'].strip()
        if not re.fullmatch(r'\+?[0-9 ()-]{7,30}', value):
            raise forms.ValidationError('شماره تماس معتبر وارد کنید؛ شماره هنوز احراز نشده است.')
        return value


def quote_rows(raw, filename):
    rows = read_table(raw, filename, QUOTE_COLUMNS)
    seen = set()
    for row in rows:
        sku = row['product_sku'].strip()
        if not sku or len(sku) > 50 or sku in seen:
            raise ShopError('INVALID_IMPORT', 'SKU خالی، طولانی یا تکراری است.')
        if sku.startswith(('=', '+', '-', '@')):
            raise ShopError('INVALID_IMPORT', 'شناسه نباید با علامت فرمول صفحه‌گسترده آغاز شود.')
        seen.add(sku)
        row['product_sku'] = sku
        for key, limit in [('purchase_price', 9007199254740991), ('stock', 2147483647)]:
            value = row[key]
            if not value.isascii() or not value.isdecimal() or len(value) > 16 or int(value) > limit:
                raise ShopError('INVALID_IMPORT', 'بهای خرید و موجودی باید عدد صحیح نامنفی در محدوده مجاز باشند.')
            row[key] = int(value)
    return rows


@never_cache
@require_http_methods(['GET', 'POST'])
@endpoint
def supplier(request):
    user = request.user
    if not user.is_authenticated or not user.is_active:
        raise ShopError('AUTH_REQUIRED', 'ابتدا حساب عادی بسازید و وارد شوید.', 401)
    if request.method == 'GET' and 'download' in request.GET:
        identifier = request.GET['download']
        if not identifier.isascii() or not identifier.isdecimal() or len(identifier) > 18:
            raise ShopError('NOT_FOUND', 'فایل یافت نشد.', 404)
        qs = SupplierSubmission.objects.all()
        if not (user.is_staff and user.has_perm('shop.view_suppliersubmission')):
            qs = qs.filter(supplier__user=user)
        item = qs.filter(pk=identifier).first()
        if not item:
            raise ShopError('NOT_FOUND', 'فایل یافت نشد.', 404)
        response = HttpResponse(bytes(item.content), content_type='application/octet-stream')
        response['Content-Disposition'] = f'attachment; filename="supplier-list-{item.pk}{PurePath(item.filename).suffix}"'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "sandbox; default-src 'none'"
        return response
    if request.method == 'POST':
        data = request.POST if request.content_type == 'multipart/form-data' else body(request)
        action = data.get('action')
        with transaction.atomic():
            # Serialize applications and upload limits, including the initial profile creation.
            get_user_model().objects.select_for_update().get(pk=user.pk)
            profile = SupplierProfile.objects.select_for_update().filter(user=user).first()
            if action == 'apply':
                throttle_account(request, 'supplier-apply', str(user.pk))
                if profile and profile.status == 'SUSPENDED':
                    raise ShopError('FORBIDDEN', 'برای بازبینی تعلیق با پشتیبانی تماس بگیرید.', 403)
                form = SupplierForm(data, instance=profile)
                if not form.is_valid():
                    raise ShopError('INVALID_PROFILE', 'نام و شماره تماس معتبر لازم است.')
                obj = form.save(commit=False)
                obj.user, obj.status, obj.review_note = user, 'PENDING', ''
                obj.save()
                AuditLog.objects.create(actor=user.get_username(), action='SUPPLIER_APPLIED', entity=f'supplierprofile:{obj.pk}')
            elif action == 'submit':
                if not profile or profile.status != 'APPROVED':
                    raise ShopError('FORBIDDEN', 'ارسال لیست پس از تأیید درخواست توسط ادمین فعال می‌شود.', 403)
                upload = request.FILES.get('file')
                if not upload or upload.size > LIMIT:
                    raise ShopError('INVALID_IMPORT', 'فایل حداکثر یک مگابایت باشد.')
                if profile.submissions.filter(status='PENDING').count() >= 10:
                    raise ShopError('RATE_LIMITED', 'ابتدا منتظر بررسی لیست‌های قبلی بمانید.', 429)
                raw = upload.read(LIMIT + 1)
                name = PurePath(upload.name.replace('\\', '/')).name
                suffix = PurePath(name).suffix.lower()
                name = name if len(name) <= 150 else name[:140] + suffix
                if suffix == '.pdf':
                    if not raw.startswith(b'%PDF-'):
                        raise ShopError('INVALID_IMPORT', 'ساختار فایل PDF معتبر نیست.')
                    rows = []
                else:
                    rows = quote_rows(raw, name)
                item = SupplierSubmission.objects.create(supplier=profile, filename=name, content=raw, rows=rows)
                AuditLog.objects.create(actor=user.get_username(), action='SUPPLIER_LIST_SUBMITTED', entity=f'suppliersubmission:{item.pk}')
            else:
                raise ShopError('INVALID_ACTION', 'عملیات معتبر نیست.')
    profile = SupplierProfile.objects.filter(user=user).first()
    return ok({'profile': {'title': profile.title, 'phone': profile.phone, 'status': profile.status,
                          'review_note': profile.review_note} if profile else None,
        'columns': QUOTE_COLUMNS,
        'submissions': list(profile.submissions.order_by('-pk')[:30].values('id', 'filename', 'status', 'review_note', 'created_at')) if profile else []})
