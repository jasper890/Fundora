import csv
import io

from django.core.exceptions import PermissionDenied, ValidationError
from django.db.models import Q
from django.http import HttpResponse, JsonResponse

from proofpay.evidence import verify_evidence
from proofpay.models import ProgramMember
from proofpay.permissions import visible_awards


def audit_awards(user,program):
    if not user.is_authenticated:
        raise PermissionDenied
    awards=visible_awards(user).filter(program=program).filter(Q(sponsor_member__user=user)|Q(verifier_member__user=user,verifier_sync_required=False))
    if not awards.exists():
        sponsor=program.members.filter(user=user,role=ProgramMember.Role.SPONSOR,active=True).exists()
        if not sponsor:
            raise PermissionDenied
    return awards


def spreadsheet_text(value):
    if isinstance(value,str) and value.lstrip().startswith(("=","+","-","@")):
        return "'"+value
    return value


def export_program(user,program,format="json"):
    if format not in ("json","csv"):
        raise ValidationError("Choose JSON or CSV.")
    awards=audit_awards(user,program)
    rows=[]
    for award in awards.prefetch_related("evidence_versions","chain_operations"):
        for evidence in award.evidence_versions.all():
            if not evidence.purged_at:
                verify_evidence(evidence)
        operations=list(award.chain_operations.order_by("created_at"))
        base={"program_id":str(program.pk),"program_title":program.title,"award_id":str(award.pk),"asset":"Testnet XLM","amount_base_units":str(award.base_units),"award_status":award.status,"version":str(award.version),"contract_id":award.contract_id or "","evidence_revision":award.evidence_revision,"evidence_digest":award.evidence_digest,"last_confirmed_ledger":str(award.last_confirmed_ledger or "")}
        for operation in operations or [None]:
            rows.append({**base,"action":operation.action if operation else "","operation_status":operation.status if operation else "","transaction_hash":operation.signed_hash or "" if operation else "","confirmed_ledger":str(operation.confirmed_ledger or "") if operation else ""})
    if format=="json":
        response=JsonResponse({"synthetic":True,"network":"TESTNET","awards":rows})
    else:
        stream=io.StringIO(newline="")
        fields=list(rows[0]) if rows else ["program_id","program_title","award_id","award_status"]
        writer=csv.DictWriter(stream,fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({key:spreadsheet_text(value) for key,value in row.items()})
        response=HttpResponse(stream.getvalue(),content_type="text/csv; charset=utf-8")
    response["Content-Disposition"]=f'attachment; filename="proofpay-{program.pk}.{format}"'
    response["Cache-Control"]="private, no-store"
    response["X-Content-Type-Options"]="nosniff"
    return response
