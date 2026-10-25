from django.contrib import admin, messages
from django.db import transaction
from .models import AuditLog, Branch, Category, CompatibilityRule, Device, FeatureFlag, Offer, Order, OrderItem, Product, StockLedger, Vendor
from .services import ShopError, cancel_reservation


def manages_marketplace(user):
    return user.is_superuser or user.has_perm('shop.manage_marketplace')


admin.site.site_header = 'مدیریت اسموک‌شاپ'
admin.site.site_title = 'اسموک‌شاپ'
admin.site.index_title = 'کاتالوگ، فروشندگان و عملیات سفارش'


class AuditedAdmin(admin.ModelAdmin):
    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            old = type(obj).objects.filter(pk=obj.pk).first() if change else None
            super().save_model(request, obj, form, change)
            changes = {name: {'before': str(getattr(old, name, '')), 'after': str(getattr(obj, name, ''))}
                       for name in form.changed_data}
            AuditLog.objects.create(actor=request.user.get_username(), action='ADMIN_UPDATE',
                                    entity=f'{obj._meta.model_name}:{obj.pk}', changes=changes)

    def has_delete_permission(self, request, obj=None):
        return False  # Deactivate catalog entries instead; retain order and audit history.


class LegalAdmin(AuditedAdmin):
    legal_fields = ()

    def get_readonly_fields(self, request, obj=None):
        if not request.user.has_perm('shop.approve_legal_status'):
            return self.legal_fields
        return ()


@admin.register(Product)
class ProductAdmin(LegalAdmin):
    legal_fields = ('legal_status', 'legal_reference')
    list_display = ('title', 'sku', 'brand', 'product_type', 'legal_status', 'stock', 'active')
    list_filter = ('product_type', 'legal_status', 'category', 'retail_available', 'wholesale_available', 'active')
    search_fields = ('title', 'sku', 'brand')
    prepopulated_fields = {'slug': ('title',)}
    list_per_page = 30
    list_select_related = ('category',)
    date_hierarchy = 'updated_at'
    fieldsets = (
        ('شناسه و دسته‌بندی', {'fields': ('title', 'slug', 'sku', 'category', 'product_type', 'brand', 'active')}),
        ('تصویر و مشخصات', {'fields': ('image', 'catalog_image', 'illustration', 'description', 'material', 'dimensions', 'flavor', 'weight_grams', 'sticks_per_pack', 'packs_per_carton')}),
        ('منبع و بررسی داده', {'fields': ('manufacturer', 'source_url', 'source_checked_on', 'specification_notes')}),
        ('عرضه مستقیم فروشگاه', {'fields': ('price', 'stock', 'retail_available', 'wholesale_available'), 'description': 'موجودی فروشندگان از بخش عرضه‌ها مدیریت می‌شود؛ این فیلدها فقط برای عرضه مستقیم بدون فروشنده‌اند.'}),
        ('تأیید حقوقی', {'fields': ('legal_status', 'legal_reference')}),
    )

    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            old_stock = Product.objects.select_for_update().get(pk=obj.pk).stock if change else 0
            super().save_model(request, obj, form, change)
            if obj.stock != old_stock:
                StockLedger.objects.create(product=obj, delta=obj.stock - old_stock, reason=f'Admin inventory: {request.user.get_username()}')


@admin.register(Category)
class CategoryAdmin(LegalAdmin):
    legal_fields = ('online_enabled',)
    list_display = ('title', 'online_enabled')


@admin.register(FeatureFlag)
class FlagAdmin(LegalAdmin):
    legal_fields = ('key', 'is_enabled')
    list_display = ('key', 'is_enabled', 'description')


@admin.register(Device)
class DeviceAdmin(AuditedAdmin):
    pass


@admin.register(Branch)
class BranchAdmin(AuditedAdmin):
    list_display = ('title', 'city', 'active')


@admin.register(CompatibilityRule)
class CompatibilityAdmin(AuditedAdmin):
    list_display = ('device', 'product', 'confidence', 'is_incompatible', 'last_verified')


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ('product', 'offer', 'seller_name', 'title', 'quantity', 'unit_price')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(ReadOnlyAdmin):
    list_display = ('id', 'status', 'total', 'created_at', 'expires_at')
    list_filter = ('status',)
    search_fields = ('id', 'items__title', 'items__seller_name')
    date_hierarchy = 'created_at'
    list_per_page = 30
    inlines = [OrderItemInline]
    actions = ['cancel_pending']

    def has_cancel_permission(self, request):
        return request.user.has_perm('shop.cancel_order')

    @admin.action(description='لغو درخواست‌های معلق و آزادسازی موجودی', permissions=['cancel'])
    def cancel_pending(self, request, queryset):
        count = 0
        for order in queryset:
            try:
                count += cancel_reservation(order.pk, actor=request.user.get_username())
            except ShopError as error:
                self.message_user(request, error.message, messages.WARNING)
        self.message_user(request, f'{count} درخواست لغو شد.')


@admin.register(AuditLog)
class AuditAdmin(ReadOnlyAdmin):
    list_display = ('actor', 'action', 'entity', 'created_at')


@admin.register(StockLedger)
class LedgerAdmin(ReadOnlyAdmin):
    list_display = ('product', 'offer', 'delta', 'reason', 'created_at')
    date_hierarchy = 'created_at'

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('product', 'offer__vendor')
        return qs if manages_marketplace(request.user) or request.user.has_perm('shop.view_order') else qs.filter(offer__vendor__members=request.user, offer__vendor__active=True).distinct()


@admin.register(Vendor)
class VendorAdmin(AuditedAdmin):
    list_display = ('title', 'city', 'active')
    list_filter = ('active',)
    search_fields = ('title', 'city')
    filter_horizontal = ('members',)
    prepopulated_fields = {'slug': ('title',)}

    def save_model(self, request, obj, form, change):
        self_members = list(obj.members.values_list('pk', flat=True)) if change else []
        obj._previous_members = self_members
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        obj = form.instance
        members = list(obj.members.values_list('pk', flat=True))
        if sorted(obj._previous_members) != sorted(members):
            AuditLog.objects.create(actor=request.user.get_username(), action='VENDOR_MEMBERS_CHANGED',
                                    entity=f'vendor:{obj.pk}', changes={'members': {'before': obj._previous_members, 'after': members}})

    def has_change_permission(self, request, obj=None):
        return manages_marketplace(request.user) and super().has_change_permission(request, obj)

    def has_add_permission(self, request):
        return manages_marketplace(request.user) and super().has_add_permission(request)

    def has_view_permission(self, request, obj=None):
        return manages_marketplace(request.user) and super().has_view_permission(request, obj)


@admin.register(Offer)
class OfferAdmin(AuditedAdmin):
    list_display = ('product', 'vendor', 'price', 'stock', 'approved', 'active', 'updated_at')
    search_fields = ('product__title', 'seller_sku')
    list_select_related = ('product', 'vendor')
    list_per_page = 30
    readonly_fields = ('updated_at',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs if manages_marketplace(request.user) else qs.filter(vendor__members=request.user, vendor__active=True).distinct()

    def get_list_filter(self, request):
        return ('vendor', 'approved', 'active') if manages_marketplace(request.user) else ('approved', 'active')

    def get_readonly_fields(self, request, obj=None):
        fields = self.readonly_fields if manages_marketplace(request.user) else (*self.readonly_fields, 'approved')
        return (*fields, 'vendor', 'product') if obj else fields

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'vendor' and not manages_marketplace(request.user):
            kwargs['queryset'] = Vendor.objects.filter(members=request.user, active=True)
        if db_field.name == 'product' and not manages_marketplace(request.user):
            kwargs['queryset'] = Product.objects.filter(active=True, legal_status__in=['APPROVED_ONLINE', 'CATALOG_ONLY', 'IN_PERSON_ONLY'])
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_add_permission(self, request):
        return super().has_add_permission(request) and (manages_marketplace(request.user) or Vendor.objects.filter(members=request.user, active=True).exists())

    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            Product.objects.select_for_update().get(pk=obj.product_id)
            old = Offer.objects.select_for_update().get(pk=obj.pk) if change else None
            if not manages_marketplace(request.user):
                if not obj.vendor.active or not obj.vendor.members.filter(pk=request.user.pk).exists():
                    from django.core.exceptions import PermissionDenied
                    raise PermissionDenied
                obj.approved = old.approved if old and old.product_id == obj.product_id and old.vendor_id == obj.vendor_id else False
            super().save_model(request, obj, form, change)
            delta = obj.stock - (old.stock if old else 0)
            if delta:
                StockLedger.objects.create(product=obj.product, offer=obj, delta=delta, reason=f'Offer inventory: {request.user.get_username()}')


@admin.register(OrderItem)
class SellerOrderItemAdmin(ReadOnlyAdmin):
    list_display = ('title', 'seller_name', 'quantity', 'unit_price', 'order_status')
    fields = ('title', 'seller_name', 'quantity', 'unit_price', 'order_status')
    readonly_fields = fields
    search_fields = ('title',)
    list_per_page = 30

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('order', 'offer__vendor')
        return qs if manages_marketplace(request.user) or request.user.has_perm('shop.view_order') else qs.filter(offer__vendor__members=request.user, offer__vendor__active=True).distinct()

    @admin.display(description='وضعیت درخواست')
    def order_status(self, obj):
        return obj.order.status

