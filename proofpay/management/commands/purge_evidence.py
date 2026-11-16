from django.core.management.base import BaseCommand, CommandError
from proofpay.models import Program
from proofpay.recovery import purge_evidence

class Command(BaseCommand):
    help="Preview or execute retention cleanup for one program; preserve financial rows."
    def add_arguments(self,parser):
        parser.add_argument("--program",required=True)
        parser.add_argument("--execute",action="store_true")
    def handle(self,*args,**options):
        try:
            program=Program.objects.get(pk=options["program"])
        except (Program.DoesNotExist,ValueError):
            raise CommandError("Program not found.") from None
        try:
            count=purge_evidence(program,execute=options["execute"])
        except OSError:
            raise CommandError("Cleanup incomplete. Check private storage access, then rerun the preview; no financial rows were removed.") from None
        self.stdout.write(f"{'Purged' if options['execute'] else 'Eligible evidence versions'}: {count}")
