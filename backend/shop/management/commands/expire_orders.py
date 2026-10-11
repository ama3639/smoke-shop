from django.core.management.base import BaseCommand
from django.utils import timezone
from shop.models import Order
from shop.services import cancel_reservation


class Command(BaseCommand):
    help = 'Release expired pending reservations exactly once. Schedule once per minute.'

    def handle(self, **options):
        ids = Order.objects.filter(status='PENDING_REVIEW', expires_at__lte=timezone.now()).values_list('pk', flat=True)
        count = sum(cancel_reservation(pk, actor='reservation-expiry', expired=True) for pk in ids.iterator())
        self.stdout.write(f'Expired {count} reservations.')
