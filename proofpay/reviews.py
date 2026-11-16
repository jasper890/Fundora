from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from proofpay.models import Award, EvidenceVersion, ProgramMember, ReviewAction
from proofpay.permissions import require_award_role
from proofpay.evidence import verify_evidence


@transaction.atomic
def record_review_request(
    user,
    award: Award,
    evidence: EvidenceVersion,
    action: str,
    rationale: str,
    *,
    expected_version: int,
    source_check_method: str = "",
) -> ReviewAction:
    award = Award.objects.select_for_update().get(pk=award.pk)
    if action not in {"APPROVE", "REJECT", "REOPEN", "REQUEST_CHANGES", "DISPUTE"}:
        raise ValidationError("Unknown review action.")
    require_award_role(
        user,
        award,
        {
            ProgramMember.Role.RECIPIENT
            if action == "DISPUTE"
            else ProgramMember.Role.VERIFIER
        },
    )
    evidence = EvidenceVersion.objects.get(pk=evidence.pk)
    latest = award.evidence_versions.first()
    if (
        award.version != expected_version
        or evidence.award_id != award.pk
        or not latest
        or latest.pk != evidence.pk
    ):
        raise ValidationError(
            "The award or evidence changed. Refresh and review the latest revision.",
            code="stale",
        )
    if (
        not award.last_confirmed_ledger
        or award.evidence_revision != evidence.revision
        or award.evidence_digest != evidence.digest
    ):
        raise ValidationError("This evidence revision has not been confirmed on-chain.")
    if not rationale.strip() or len(rationale) > 2000 or len(source_check_method) > 512:
        raise ValidationError(
            "Provide a rationale up to 2,000 characters and a source check up to 512 characters."
        )
    if action != "DISPUTE" and not source_check_method.strip():
        raise ValidationError("Describe the original source record you checked.")
    states = {
        "APPROVE": {"SUBMITTED"},
        "REJECT": {"SUBMITTED", "APPROVED"},
        "REOPEN": {"REJECTED", "APPROVED"},
        "REQUEST_CHANGES": {"SUBMITTED", "APPROVED", "REJECTED"},
        "DISPUTE": {"SUBMITTED", "REJECTED", "APPROVED"},
    }
    if award.status not in states[action]:
        raise ValidationError("This action is unavailable in the current award state.")
    if action != "DISPUTE" and timezone.now() > award.program.review_deadline:
        raise ValidationError("The review deadline has passed.")
    verify_evidence(evidence)
    return ReviewAction.objects.create(
        award=award,
        evidence=evidence,
        verifier=user,
        action=action,
        rationale=rationale,
        source_check_method=source_check_method,
        expected_version=expected_version,
    )
