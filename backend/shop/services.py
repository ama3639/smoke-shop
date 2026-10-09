from django.db import transaction
from django.db.models import F
from .models import AuditLog, CartItem, FeatureFlag, Order, OrderItem, Product, StockLedger


class ShopError(Exception):
    def __init__(self, code, message, status=400):
        self.code, self.message, self.status = code, message, status


def can_purchase(product):
    return (product.active and product.product_type != 'cigarette' and product.legal_status == Product.LegalStatus.APPROVED_ONLINE
            and bool(product.legal_reference.strip()) and product.category.online_enabled
            and FeatureFlag.enabled('cart'))


def check_purchase(product):
    if not can_purchase(product):
        raise ShopError('LEGAL_STATUS_BLOCKED', 'خرید آنلاین این کالا فعال نیست.', 403)
    if product.price <= 0:
        raise ShopError('PRICE_UNAVAILABLE', 'قیمت این کالا هنوز مشخص نشده است.', 409)


def checkout(cart, key):
    # Serialize each cart; conditional stock updates prevent overselling across carts.
    with transaction.atomic():
        type(cart).objects.select_for_update().get(pk=cart.pk)
        existing = Order.objects.filter(idempotency_key=key).first()
        if existing:
            if existing.cart_id != cart.pk:
                raise ShopError('KEY_CONFLICT', 'شناسه درخواست تکراری است.', 409)
            return existing
        if not FeatureFlag.enabled('order_requests'):
            raise ShopError('CHECKOUT_DISABLED', 'ثبت سفارش هنوز فعال نشده است.', 503)
        items = list(cart.items.select_related('product__category').order_by('product_id'))
        if not items:
            raise ShopError('EMPTY_CART', 'سبد خرید خالی است.')
        total = 0
        for item in items:
            product = Product.objects.select_for_update().select_related('category').get(pk=item.product_id)
            check_purchase(product)
            if not Product.objects.filter(pk=product.pk, stock__gte=item.quantity).update(stock=F('stock') - item.quantity):
                raise ShopError('OUT_OF_STOCK', 'موجودی کافی نیست؛ سبد را بازبینی کنید.', 409)
            item.product = product
            total += product.price * item.quantity
        order = Order.objects.create(cart=cart, idempotency_key=key, total=total)
        for item in items:
            OrderItem.objects.create(order=order, product=item.product, title=item.product.title,
                                     quantity=item.quantity, unit_price=item.product.price)
            StockLedger.objects.create(product=item.product, delta=-item.quantity, reason=f'Order reservation {order.pk}')
        CartItem.objects.filter(cart=cart).delete()
        AuditLog.objects.create(actor='guest', action='ORDER_RESERVED', entity=str(order.pk), changes={'total': total})
        return order
