from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .models import AuditLog, CartItem, FeatureFlag, Offer, Order, OrderItem, Product, StockLedger


class ShopError(Exception):
    def __init__(self, code, message, status=400):
        self.code, self.message, self.status = code, message, status


def can_purchase(product, cart_enabled=None):
    return (product.active and product.product_type not in ('cigarette', 'tobacco')
            and product.legal_status == Product.LegalStatus.APPROVED_ONLINE
            and bool(product.legal_reference.strip()) and product.category.online_enabled
            and (FeatureFlag.enabled('cart') if cart_enabled is None else cart_enabled))


def can_purchase_offer(offer, cart_enabled=None):
    return (offer.active and offer.approved and offer.vendor.active
            and can_purchase(offer.product, cart_enabled) and offer.price > 0)


def check_purchase(product, offer=None):
    if not can_purchase(product) or (offer is not None and not (offer.active and offer.approved and offer.vendor.active)):
        raise ShopError('LEGAL_STATUS_BLOCKED', 'خرید آنلاین این کالا فعال نیست.', 403)
    if (offer.price if offer else product.price) <= 0:
        raise ShopError('PRICE_UNAVAILABLE', 'قیمت این کالا هنوز مشخص نشده است.', 409)


def checkout(cart, key):
    with transaction.atomic():
        type(cart).objects.select_for_update().get(pk=cart.pk)
        existing = Order.objects.filter(idempotency_key=key).first()
        if existing:
            if existing.cart_id != cart.pk:
                raise ShopError('KEY_CONFLICT', 'شناسه درخواست تکراری است.', 409)
            return existing
        if not FeatureFlag.enabled('order_requests'):
            raise ShopError('CHECKOUT_DISABLED', 'ثبت سفارش هنوز فعال نشده است.', 503)
        items = list(cart.items.select_related('product__category').order_by('product_id', 'offer_id'))
        if not items:
            raise ShopError('EMPTY_CART', 'سبد خرید خالی است.')
        total = 0
        for item in items:
            product = Product.objects.select_for_update().select_related('category').get(pk=item.product_id)
            offer = None
            if item.offer_id:
                offer = Offer.objects.select_for_update().select_related('vendor').get(pk=item.offer_id)
                if offer.product_id != item.product_id:
                    raise ShopError('OFFER_CHANGED', 'عرضه تغییر کرده است؛ سبد را بازبینی کنید.', 409)
                offer.product = product
            elif product.offers.exists():
                raise ShopError('SELLER_REQUIRED', 'فروشنده این کالا را انتخاب کنید.', 409)
            check_purchase(product, offer)
            inventory = Offer.objects.filter(pk=offer.pk) if offer else Product.objects.filter(pk=product.pk)
            if not inventory.filter(stock__gte=item.quantity).update(stock=F('stock') - item.quantity, updated_at=timezone.now()):
                raise ShopError('OUT_OF_STOCK', 'موجودی کافی نیست؛ سبد را بازبینی کنید.', 409)
            item.product, item.offer = product, offer
            total += (offer.price if offer else product.price) * item.quantity
        order = Order.objects.create(cart=cart, idempotency_key=key, total=total,
                                     expires_at=timezone.now() + timedelta(minutes=settings.ORDER_RESERVATION_MINUTES))
        for item in items:
            OrderItem.objects.create(order=order, product=item.product, offer=item.offer,
                                     seller_name=item.offer.vendor.title if item.offer else '', title=item.product.title,
                                     quantity=item.quantity, unit_price=item.offer.price if item.offer else item.product.price)
            StockLedger.objects.create(product=item.product, offer=item.offer, delta=-item.quantity, reason=f'Order reservation {order.pk}')
        CartItem.objects.filter(cart=cart).delete()
        AuditLog.objects.create(actor='guest', action='ORDER_RESERVED', entity=str(order.pk), changes={'total': total})
        return order


@transaction.atomic
def cancel_reservation(order_id, actor='operator-cli', expired=False):
    order = Order.objects.select_for_update().get(pk=order_id)
    if order.status in ('CANCELLED', 'EXPIRED'):
        return False
    if order.status != 'PENDING_REVIEW':
        raise ShopError('ORDER_STATE', 'فقط درخواست در انتظار بررسی قابل لغو است.', 409)
    if expired and (not order.expires_at or order.expires_at > timezone.now()):
        return False
    for item in order.items.order_by('product_id', 'offer_id'):
        inventory = Offer.objects.filter(pk=item.offer_id) if item.offer_id else Product.objects.filter(pk=item.product_id)
        inventory.update(stock=F('stock') + item.quantity, updated_at=timezone.now())
        StockLedger.objects.create(product_id=item.product_id, offer_id=item.offer_id,
                                   delta=item.quantity, reason=f'Cancel reservation {order.pk}')
    order.status = 'EXPIRED' if expired else 'CANCELLED'
    order.save(update_fields=['status'])
    AuditLog.objects.create(actor=actor, action=f'ORDER_{order.status}', entity=str(order.pk))
    return True
