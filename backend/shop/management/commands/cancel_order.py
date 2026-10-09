import uuid
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import F
from shop.models import AuditLog, Order, Product, StockLedger


class Command(BaseCommand):
    help = 'Cancel a pending request and release stock exactly once.'

    def add_arguments(self, parser):
        parser.add_argument('order_id')

    @transaction.atomic
    def handle(self, order_id, **options):
        try:
            order = Order.objects.select_for_update().get(pk=uuid.UUID(order_id))
        except (ValueError, Order.DoesNotExist):
            raise CommandError('Order not found.')
        if order.status == 'CANCELLED':
            self.stdout.write('Already cancelled; stock unchanged.')
            return
        if order.status != 'PENDING_REVIEW':
            raise CommandError('Only pending requests may be cancelled.')
        for item in order.items.order_by('product_id'):
            Product.objects.filter(pk=item.product_id).update(stock=F('stock') + item.quantity)
            StockLedger.objects.create(product=item.product, delta=item.quantity, reason=f'Cancel reservation {order.pk}')
        order.status = 'CANCELLED'
        order.save(update_fields=['status'])
        AuditLog.objects.create(actor='operator-cli', action='ORDER_CANCELLED', entity=str(order.pk))
        self.stdout.write(self.style.SUCCESS('Reservation cancelled; stock released.'))
