from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Add catalog and legal groups without removing existing permissions.'

    def handle(self, *args, **options):
        editor, _ = Group.objects.get_or_create(name='Catalog editor')
        reviewer, _ = Group.objects.get_or_create(name='Legal reviewer')
        for group in [editor, reviewer]:
            for model in ['product', 'category', 'device', 'compatibilityrule', 'branch']:
                group.permissions.add(*Permission.objects.filter(content_type__app_label='shop', codename__in=[f'{action}_{model}' for action in ['view', 'add', 'change']]))
        reviewer.permissions.add(*Permission.objects.filter(content_type__app_label='shop', codename__in=['approve_legal_status', 'view_featureflag', 'change_featureflag']))
        manager, _ = Group.objects.get_or_create(name='Marketplace manager')
        seller, _ = Group.objects.get_or_create(name='Seller')
        operator, _ = Group.objects.get_or_create(name='Order operator')
        manager.permissions.add(*Permission.objects.filter(content_type__app_label='shop', codename__in=[
            'manage_marketplace', 'view_vendor', 'add_vendor', 'change_vendor', 'view_offer', 'add_offer', 'change_offer',
            'view_order', 'view_orderitem', 'view_stockledger', 'view_auditlog', 'cancel_order']))
        seller.permissions.add(*Permission.objects.filter(content_type__app_label='shop', codename__in=[
            'view_offer', 'add_offer', 'change_offer', 'view_orderitem', 'view_stockledger']))
        operator.permissions.add(*Permission.objects.filter(content_type__app_label='shop', codename__in=['view_order', 'view_orderitem', 'view_stockledger', 'cancel_order']))
        self.stdout.write(self.style.SUCCESS('Catalog and legal roles prepared. Mark assigned users as staff to access admin.'))
