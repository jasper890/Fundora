"""Display-only award copy. Never writes to the database or prepares chain actions."""

from proofpay.chain import ACTIVE
from proofpay.models import Award, ProgramMember


_CONFIRMED_PRIMARY = {
    Award.Status.CREATED: "Award created. Not funded yet.",
    Award.Status.FUNDED: "Award funded. Submission needed.",
    Award.Status.SUBMITTED: "Waiting for verifier review.",
    Award.Status.APPROVED: "Approved. Waiting for sponsor release.",
    Award.Status.REJECTED: "Submission rejected by the verifier.",
    Award.Status.PAID: "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
    Award.Status.REFUNDED: "Unpaid funds returned to the sponsor.",
    Award.Status.CANCELLED: "Award cancelled before funding.",
}

_HAPPY_PATH = (
    (Award.Status.CREATED, "Award created. Not funded yet."),
    (Award.Status.FUNDED, "Award funded. Submission needed."),
    (Award.Status.SUBMITTED, "Waiting for verifier review."),
    (Award.Status.APPROVED, "Approved. Waiting for sponsor release."),
    (Award.Status.PAID, "Payment confirmed: 20 Testnet XLM sent to your assigned wallet."),
)

_RANK = {
    Award.Status.CREATED: 0,
    Award.Status.FUNDED: 1,
    Award.Status.SUBMITTED: 2,
    Award.Status.APPROVED: 3,
    Award.Status.PAID: 4,
}


def _has_local_unsigned_evidence(award):
    latest = award.evidence_versions.first()
    if latest is None:
        return False
    if not award.last_confirmed_ledger:
        return True
    return not (
        award.evidence_revision == latest.revision
        and award.evidence_digest == latest.digest
        and award.status
        in (
            Award.Status.SUBMITTED,
            Award.Status.APPROVED,
            Award.Status.REJECTED,
            Award.Status.PAID,
            Award.Status.REFUNDED,
        )
    )


def _has_unresolved_operation(award):
    return award.chain_operations.filter(status__in=ACTIVE).exists()


def _role_for(award, user):
    if award.sponsor_member.user_id == user.pk and award.sponsor_member.active:
        return ProgramMember.Role.SPONSOR
    if award.verifier_member.user_id == user.pk and award.verifier_member.active:
        return ProgramMember.Role.VERIFIER
    if award.recipient_member.user_id == user.pk and award.recipient_member.active:
        return ProgramMember.Role.RECIPIENT
    return None


def status_lines(award):
    """Primary status line first, then secondary notices. Ledger-gated truth only."""
    if not award.last_confirmed_ledger:
        return [
            "Not confirmed on-chain",
            "This page does not confirm funding or payment.",
        ]

    lines = []
    if award.status == Award.Status.FUNDED and _has_local_unsigned_evidence(award):
        lines.append("Evidence saved. Submission not yet signed.")
    else:
        lines.append(_CONFIRMED_PRIMARY.get(award.status, award.get_status_display()))

    if award.status == Award.Status.PAID:
        lines.append("Not a bank receipt.")

    if award.sponsor_hold or award.verifier_hold:
        lines.append("Review hold active. Payment is blocked.")

    if _has_unresolved_operation(award):
        lines.append("Outcome not confirmed. We are checking Stellar.")

    return lines


def next_step(award, user):
    """One sentence for what this account should do next on this award."""
    role = _role_for(award, user)

    if not award.last_confirmed_ledger:
        if role == ProgramMember.Role.SPONSOR:
            return "Review award deployment. Signing is not confirmation."
        return "Wait for a confirmed chain snapshot before treating this as funded or paid."

    if award.sponsor_hold or award.verifier_hold:
        if role in (ProgramMember.Role.SPONSOR, ProgramMember.Role.VERIFIER):
            return "Review the hold. Payment stays blocked until it is cleared."
        return "Payment is blocked by a review hold."

    if _has_unresolved_operation(award):
        return "Refresh status. Do not prepare a second payment."

    status = award.status
    if status == Award.Status.CREATED:
        if role == ProgramMember.Role.SPONSOR:
            return "Review funding. Signing is not confirmation."
        return "Waiting for the sponsor to fund this award."

    if status == Award.Status.FUNDED:
        if _has_local_unsigned_evidence(award):
            if role == ProgramMember.Role.RECIPIENT:
                return "Review and sign submission."
            return "Waiting for the recipient to sign submission."
        if role == ProgramMember.Role.RECIPIENT:
            return "Add completion evidence."
        return "Waiting for the recipient to add completion evidence."

    if status == Award.Status.SUBMITTED:
        if role == ProgramMember.Role.VERIFIER:
            return "Check the original source, then request approval or changes."
        return "Waiting for verifier review."

    if status == Award.Status.APPROVED:
        if role == ProgramMember.Role.SPONSOR:
            return "Review payment. Signing is not confirmation."
        return "Waiting for the sponsor to release payment."

    if status == Award.Status.REJECTED:
        if role == ProgramMember.Role.RECIPIENT:
            return "Review the rejection and any permitted dispute path."
        if role == ProgramMember.Role.VERIFIER:
            return "Rejection is recorded. Reopening requires a separate action."
        return "Review the rejected submission."

    if status == Award.Status.PAID:
        return "Payment is confirmed on Testnet. View the audit record if you need the transaction."

    if status == Award.Status.REFUNDED:
        return "Unpaid funds were returned to the sponsor. No stipend was paid."

    if status == Award.Status.CANCELLED:
        return "This award was cancelled before funding."

    return "Open the award for the current terms and history."


def tracker_steps(award):
    """Handoff steps for the award page. Done requires a confirmed ledger."""
    primary = status_lines(award)[0]

    if not award.last_confirmed_ledger:
        return [
            {"label": primary, "mark": "current"},
            {"label": "Award funded. Submission needed.", "mark": "waiting"},
            {"label": "Waiting for verifier review.", "mark": "waiting"},
            {"label": "Approved. Waiting for sponsor release.", "mark": "waiting"},
            {
                "label": "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
                "mark": "waiting",
            },
        ]

    if award.status == Award.Status.REJECTED:
        return [
            {"label": "Award funded. Submission needed.", "mark": "done"},
            {"label": primary, "mark": "current"},
            {"label": "Approved. Waiting for sponsor release.", "mark": "waiting"},
            {
                "label": "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
                "mark": "waiting",
            },
        ]

    if award.status == Award.Status.REFUNDED:
        return [
            {"label": "Award funded. Submission needed.", "mark": "done"},
            {"label": primary, "mark": "current"},
            {
                "label": "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
                "mark": "waiting",
            },
        ]

    if award.status == Award.Status.CANCELLED:
        return [
            {"label": primary, "mark": "current"},
            {"label": "Award funded. Submission needed.", "mark": "waiting"},
            {"label": "Waiting for verifier review.", "mark": "waiting"},
            {"label": "Approved. Waiting for sponsor release.", "mark": "waiting"},
            {
                "label": "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
                "mark": "waiting",
            },
        ]

    if award.status == Award.Status.FUNDED and _has_local_unsigned_evidence(award):
        return [
            {"label": "Award funded. Submission needed.", "mark": "done"},
            {"label": primary, "mark": "current"},
            {"label": "Waiting for verifier review.", "mark": "waiting"},
            {"label": "Approved. Waiting for sponsor release.", "mark": "waiting"},
            {
                "label": "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
                "mark": "waiting",
            },
        ]

    rank = _RANK[award.status]
    steps = []
    for status, label in _HAPPY_PATH:
        step_rank = _RANK[status]
        if step_rank < rank:
            steps.append({"label": label, "mark": "done"})
        elif step_rank == rank:
            mark = "done" if status == Award.Status.PAID else "current"
            steps.append({"label": primary, "mark": mark})
        else:
            steps.append({"label": label, "mark": "waiting"})
    return steps
