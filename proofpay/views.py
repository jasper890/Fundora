from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, FileResponse, Http404
from django.core.exceptions import ValidationError, PermissionDenied
from django.shortcuts import redirect
from django.contrib import messages
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods
from proofpay.forms import EvidenceForm
from proofpay.models import EvidenceVersion
from proofpay.evidence import store_evidence, verify_evidence, private_path
from proofpay.reviews import record_review_request
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_POST

from proofpay.models import ProgramMember
from proofpay.permissions import require_award_role, visible_awards
from proofpay.presentation import (
    home_copy,
    next_step,
    pick_upcoming_award,
    sort_awards_for_home,
    status_lines,
    tracker_steps,
)


def _decorate_awards(awards, user):
    decorated = []
    for award in awards:
        award.status_lines = status_lines(award)
        award.next_step = next_step(award, user)
        decorated.append(award)
    return decorated


def _workspace_role(memberships):
    roles = {membership.role for membership in memberships}
    if len(roles) == 1:
        return next(iter(roles))
    return None


@login_required
def program_list(request):
    memberships = list(
        ProgramMember.objects.filter(
            user=request.user, active=True
        ).select_related("program")
    )
    role = _workspace_role(memberships)
    awards = sort_awards_for_home(
        _decorate_awards(
            visible_awards(request.user).select_related(
                "program",
                "sponsor_member",
                "verifier_member",
                "recipient_member",
            ),
            request.user,
        ),
        request.user,
    )
    return render(
        request,
        "proofpay/program_list.html",
        {
            "memberships": memberships,
            "awards": awards,
            "workspace_role": role,
            "home": home_copy(role),
            "upcoming": pick_upcoming_award(awards, request.user),
            "recipient_home": role == ProgramMember.Role.RECIPIENT,
        },
    )


@login_required
@never_cache
def award_detail(request, award_id):
    award = get_object_or_404(visible_awards(request.user), pk=award_id)
    return render(request, "proofpay/award_detail.html", award_context(request, award))


def award_context(request, award, form=None):
    from datetime import datetime, timezone

    terms = {
        "requirements_text": award.deployment_manifest.get(
            "requirements_text", award.program.requirements_text
        )
    }
    for name in ("claim_deadline", "review_deadline", "payout_deadline"):
        terms[name] = (
            datetime.fromtimestamp(award.deployment_manifest[name], timezone.utc)
            if name in award.deployment_manifest
            else getattr(award.program, name)
        )
    latest = award.evidence_versions.first()
    recipient = (
        award.recipient_member.user_id == request.user.pk
        and award.recipient_member.active
    )
    verifier = (
        award.verifier_member.user_id == request.user.pk
        and award.verifier_member.active
    )
    sponsor = (
        award.sponsor_member.user_id == request.user.pk
        and award.sponsor_member.active
    )
    return {
        "award": award,
        "replacement_verifiers": award.program.members.filter(
            role="VERIFIER", active=True
        ).exclude(pk=award.verifier_member_id),
        "chain_operations": (
            award.chain_operations.filter(actor=request.user)
            if recipient
            else award.chain_operations.all()
        ).order_by("-created_at")[:10],
        "chain_action_choices": chain_action_choices(request.user, award),
        "latest": latest,
        "terms": terms,
        "versions": award.evidence_versions.prefetch_related("files"),
        "reviews": award.review_actions.select_related("evidence"),
        "is_recipient": recipient,
        "is_verifier": verifier,
        "is_sponsor": sponsor,
        "status_lines": status_lines(award),
        "next_step": next_step(award, request.user),
        "tracker_steps": tracker_steps(award),
        "review_values": {"source_check_method": "", "rationale": ""},
        "form": form
        or EvidenceForm(
            initial={"expected_revision": latest.revision if latest else 0}
        ),
    }


@login_required
@never_cache
@require_http_methods(["GET", "POST"])
def evidence_upload(request, award_id):
    award = get_object_or_404(visible_awards(request.user), pk=award_id)
    require_award_role(request.user, award, {ProgramMember.Role.RECIPIENT})
    if request.method == "GET":
        return redirect("award_detail", award_id=award.pk)
    form = EvidenceForm(request.POST)
    status = 400
    if form.is_valid():
        try:
            store_evidence(
                request.user, award, request.FILES.getlist("files"), **form.cleaned_data
            )
        except ValidationError as error:
            form.add_error(None, error)
            status = 409 if getattr(error, "code", None) == "stale" else 400
        else:
            messages.success(
                request, "Evidence saved. Submission is not yet signed or confirmed."
            )
            return redirect("award_detail", award_id=award.pk)
    return render(
        request,
        "proofpay/award_detail.html",
        award_context(request, award, form),
        status=status,
    )


@login_required
@never_cache
def evidence_download(request, evidence_id):
    evidence = get_object_or_404(
        EvidenceVersion.objects.filter(award__in=visible_awards(request.user)),
        pk=evidence_id,
    )
    try:
        verify_evidence(evidence)
        index = int(request.GET.get("file", "0"))
        entries = list(evidence.files.order_by("pk"))
        if index < 0 or index >= len(entries):
            raise Http404
        entry = entries[index]
        handle = private_path(entry.storage_name).open("rb")
    except (ValidationError, OSError, ValueError):
        raise Http404("Evidence unavailable.") from None
    response = FileResponse(
        handle,
        as_attachment=True,
        filename=entry.filename,
        content_type=entry.content_type,
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


@login_required
@never_cache
@require_POST
def review_request(request, award_id, action=None):
    award = get_object_or_404(visible_awards(request.user), pk=award_id)
    action = action or request.POST.get("action", "")
    import uuid

    try:
        evidence_id = uuid.UUID(request.POST.get("evidence_id", ""))
    except (ValueError, TypeError, AttributeError):
        raise Http404 from None
    evidence = get_object_or_404(EvidenceVersion, pk=evidence_id, award=award)
    try:
        record_review_request(
            request.user,
            award,
            evidence,
            action,
            request.POST.get("rationale", ""),
            expected_version=int(request.POST.get("expected_version", "-1")),
            source_check_method=request.POST.get("source_check_method", ""),
            source_confirmed=request.POST.get("source_confirmed") == "on",
        )
    except (ValidationError, ValueError) as error:
        context = award_context(request, award)
        context["review_error"] = (
            " ".join(error.messages)
            if isinstance(error, ValidationError)
            else "Invalid award version."
        )
        context["review_values"] = request.POST
        return render(
            request,
            "proofpay/award_detail.html",
            context,
            status=409 if getattr(error, "code", None) == "stale" else 400,
        )
    messages.success(
        request,
        "Request recorded. This does not change the contract or confirm payment.",
    )
    return redirect("award_detail", award_id=award.pk)


def chain_action_choices(user, award):
    from proofpay.chain import ACTIVE
    from proofpay.models import ChainOperation

    role_members = (award.sponsor_member, award.verifier_member, award.recipient_member)
    current = next(
        (member for member in role_members if member.user_id == user.pk), None
    )
    if not current:
        return []
    if ChainOperation.objects.filter(
        signer=current.public_wallet, status__in=ACTIVE, reserves_source=True
    ).exists():
        return [("REFUND", "Review expiry refund")] if current.role == "SPONSOR" else []
    if user.pk == award.sponsor_member.user_id:
        if not award.contract_id:
            return [("DEPLOY", "Review award deployment")]
        options = {
            "CREATED": [("FUND", "Review funding"), ("CANCEL", "Review cancellation")],
            "APPROVED": [("PAY", "Review payment")],
            "FUNDED": [],
            "SUBMITTED": [],
            "REJECTED": [],
        }.get(award.status, [])
        if award.status in ("FUNDED", "SUBMITTED", "APPROVED", "REJECTED"):
            options += [("REFUND", "Review expiry refund")]
        if award.status in ("CREATED", "FUNDED", "SUBMITTED", "APPROVED", "REJECTED"):
            options += [("REPLACE_VERIFIER", "Review verifier replacement")]
        if award.status in ("FUNDED", "SUBMITTED", "APPROVED", "REJECTED"):
            options += [("SET_HOLD", "Review hold change")]
        options += [("EXTEND_TTL", "Review lifetime extension")]
        return options
    if (
        user.pk == award.recipient_member.user_id
        and award.status in ("FUNDED", "SUBMITTED")
        and award.evidence_versions.exists()
    ):
        return [
            ("SUBMIT", "Review evidence submission"),
            ("EXTEND_TTL", "Review lifetime extension"),
        ]
    if user.pk == award.verifier_member.user_id:
        return (
            {
                "SUBMITTED": [
                    ("APPROVE", "Review approval"),
                    ("REJECT", "Review rejection"),
                ],
                "APPROVED": [
                    ("REJECT", "Review rejection"),
                    ("REOPEN", "Review reopening"),
                ],
                "REJECTED": [("REOPEN", "Review reopening")],
            }.get(award.status, [])
            + (
                [("SET_HOLD", "Review hold change")]
                if award.status in ("FUNDED", "SUBMITTED", "APPROVED", "REJECTED")
                else []
            )
            + [("EXTEND_TTL", "Review lifetime extension")]
        )
    return [("EXTEND_TTL", "Review lifetime extension")] if award.contract_id else []


@login_required
@never_cache
def program_detail(request, program_id):
    from proofpay.models import Program
    from django.utils import timezone
    program=get_object_or_404(Program,pk=program_id,members__user=request.user,members__active=True)
    membership = get_object_or_404(
        ProgramMember, program=program, user=request.user, active=True
    )
    awards_qs=visible_awards(request.user).filter(program=program).select_related(
        "recipient_member__user",
        "sponsor_member",
        "verifier_member",
        "recipient_member",
    )
    counts={name:awards_qs.filter(status=name,last_confirmed_ledger__isnull=False).count() for name in ("FUNDED","SUBMITTED","APPROVED","PAID","REFUNDED")}
    counts["ENROLLED"]=awards_qs.count()
    counts["REFUNDABLE"]=awards_qs.filter(status__in=("FUNDED","SUBMITTED","APPROVED","REJECTED"),last_confirmed_ledger__isnull=False,program__payout_deadline__lt=timezone.now()).count()
    awards=sort_awards_for_home(
        _decorate_awards(awards_qs, request.user),
        request.user,
    )
    from proofpay.exports import audit_awards
    try:
        audit_awards(request.user,program)
        can_export=True
    except PermissionDenied:
        can_export=False
    return render(
        request,
        "proofpay/program_detail.html",
        {
            "program": program,
            "awards": awards,
            "counts": counts,
            "can_export": can_export,
            "workspace_role": membership.role,
            "home": home_copy(membership.role),
            "upcoming": pick_upcoming_award(awards, request.user),
            "recipient_home": membership.role == ProgramMember.Role.RECIPIENT,
        },
    )


@login_required
@never_cache
def program_export(request, program_id):
    from proofpay.models import Program
    from proofpay.exports import export_program
    program=get_object_or_404(Program,pk=program_id,members__user=request.user,members__active=True)
    try:
        return export_program(request.user,program,request.GET.get("format","json"))
    except ValidationError:
        return JsonResponse({"error":"EXPORT_UNAVAILABLE","detail":"Check evidence integrity or the requested format."},status=400)


@login_required
@never_cache
def award_audit(request, award_id):
    award=get_object_or_404(visible_awards(request.user),pk=award_id)
    operations=award.chain_operations.select_related("actor").prefetch_related("observations").order_by("created_at")
    return render(request,"proofpay/award_audit.html",{"award":award,"operations":operations,"reviews":award.review_actions.select_related("evidence"),"evidence_versions":award.evidence_versions.all()})


@login_required
@never_cache
def wallet_check(request):
    return render(request,"proofpay/wallet_check.html")
