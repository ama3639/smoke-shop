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
        self.stdout.write(self.style.SUCCESS('Catalog and legal roles prepared. Mark assigned users as staff to access admin.'))
