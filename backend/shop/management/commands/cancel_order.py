import uuid
from django.core.management.base import BaseCommand, CommandError
from shop.models import Order
from shop.services import ShopError, cancel_reservation


class Command(BaseCommand):
    help = 'Cancel a pending request and release stock exactly once.'

    def add_arguments(self, parser):
        parser.add_argument('order_id')

    def handle(self, order_id, **options):
        try:
            changed = cancel_reservation(uuid.UUID(order_id))
        except (ValueError, Order.DoesNotExist):
            raise CommandError('Order not found.')
        except ShopError as error:
            raise CommandError(error.message)
        self.stdout.write(self.style.SUCCESS('Reservation cancelled; stock released.') if changed else 'Already cancelled; stock unchanged.')
