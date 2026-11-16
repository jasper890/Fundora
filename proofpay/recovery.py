from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from proofpay import chain
from proofpay.chain import ChainError
from proofpay.evidence import private_path
from proofpay.models import Award, EvidenceVersion, EvidenceFile, ProgramMember, ReviewAction


def refresh_award(award: Award) -> Award:
    if not award.contract_id:
        return award
    try:
        snapshot=chain.gateway().read_award(award)
    except Exception as error:  # noqa: BLE001 - unavailable state must preserve the previous financial record.
        code=error.code if isinstance(error,ChainError) else "RPC_UNAVAILABLE"
        Award.objects.filter(pk=award.pk).update(deployment_error=code)
        award.refresh_from_db()
        return award
    with transaction.atomic():
        award=Award.objects.select_for_update().get(pk=award.pk)
        if snapshot["version"]<award.version or snapshot["ledger"]<(award.last_confirmed_ledger or 0) or (award.status in ("PAID","REFUNDED","CANCELLED") and award.status!=snapshot["status"]):
            award.deployment_error="SNAPSHOT_REGRESSION"
            award.save(update_fields=("deployment_error",))
            return award
        verifier=ProgramMember.objects.filter(program=award.program,role="VERIFIER",public_wallet=snapshot["verifier"],active=True).first()
        if not verifier:
            award.verifier_sync_required=True
            award.deployment_error="VERIFIER_RECONCILIATION_REQUIRED"
            award.save(update_fields=("verifier_sync_required","deployment_error"))
            return award
        award.verifier_member=verifier
        award.verifier_sync_required=False
        award.deployment_error=""
        for name in ("status","version","evidence_revision","sponsor_hold","verifier_hold"):
            setattr(award,name,snapshot[name])
        award.evidence_digest=snapshot.get("evidence_digest") or ""
        award.last_confirmed_ledger=snapshot["ledger"]
        if award.status in ("PAID","REFUNDED") and not award.settled_at:
            award.settled_at=timezone.now()
        award.save()
        return award


def purge_evidence(program, *, execute: bool=False) -> int:
    cutoff=timezone.now()-timedelta(days=30)
    eligible=EvidenceVersion.objects.filter(award__program=program,award__status__in=("PAID","REFUNDED"),award__settled_at__lt=cutoff,purged_at__isnull=True)
    if not execute:
        return eligible.count()
    count=0
    for version_id in eligible.values_list("pk",flat=True):
        with transaction.atomic():
            version=EvidenceVersion.objects.select_for_update().get(pk=version_id)
            award=Award.objects.select_for_update().get(pk=version.award_id)
            if version.purged_at or award.status not in ("PAID","REFUNDED") or not award.settled_at or award.settled_at>=cutoff:
                continue
            for entry in version.files.all():
                private_path(entry.storage_name).unlink(missing_ok=True)
            EvidenceFile.objects.filter(version=version).update(filename="Removed under retention policy")
            EvidenceVersion.objects.filter(pk=version.pk).update(purged_at=timezone.now(),manifest="",nonce="",explanation="",source_ref="")
            ReviewAction.objects.filter(award=award).update(rationale="",source_check_method="")
            count+=1
    return count
