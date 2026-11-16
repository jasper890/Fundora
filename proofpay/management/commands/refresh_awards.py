from django.core.management.base import BaseCommand, CommandError
from proofpay.models import Award
from proofpay.recovery import refresh_award

class Command(BaseCommand):
    help="Rebuild verified award projections after restart; never deploy, fund or resubmit."
    def add_arguments(self,parser):
        parser.add_argument("--program",required=True)
    def handle(self,*args,**options):
        try:
            awards=Award.objects.filter(program_id=options["program"],contract_id__isnull=False)
            for award in awards.iterator(chunk_size=20):
                result=refresh_award(award)
                self.stdout.write(f"{result.pk} {result.deployment_error or 'VERIFIED'}")
        except ValueError:
            raise CommandError("Invalid program identifier.") from None
