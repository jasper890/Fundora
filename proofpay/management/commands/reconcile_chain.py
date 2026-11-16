import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from proofpay.chain import reconcile
from proofpay.models import ChainOperation


class Command(BaseCommand):
    help = "Reconcile persisted transaction hashes without rebuilding or resubmitting."

    def add_arguments(self, parser):
        parser.add_argument("--watch", action="store_true")

    def handle(self, *args, **options):
        while True:
            close_old_connections()
            for operation in ChainOperation.objects.filter(
                status__in=("SIGNED", "SUBMITTED", "UNKNOWN")
            ).iterator(chunk_size=50):
                result = reconcile(operation)
                self.stdout.write(f"{result.pk} {result.status}")
            if not options["watch"]:
                break
            time.sleep(15)
