from django.contrib import admin
from django.db import transaction
from .models import AuditLog, Branch, Category, CompatibilityRule, Device, FeatureFlag, Order, OrderItem, Product, StockLedger


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
    readonly_fields = ('product', 'title', 'quantity', 'unit_price')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(ReadOnlyAdmin):
    list_display = ('id', 'status', 'total', 'created_at')
    inlines = [OrderItemInline]


@admin.register(AuditLog)
class AuditAdmin(ReadOnlyAdmin):
    list_display = ('actor', 'action', 'entity', 'created_at')


@admin.register(StockLedger)
class LedgerAdmin(ReadOnlyAdmin):
    list_display = ('product', 'delta', 'reason', 'created_at')
