from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, FileResponse, Http404
from django.core.exceptions import ValidationError
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


@login_required
def program_list(request):
    memberships = ProgramMember.objects.filter(
        user=request.user, active=True
    ).select_related("program")
    return render(
        request,
        "proofpay/program_list.html",
        {
            "memberships": memberships,
            "awards": visible_awards(request.user).select_related("program"),
        },
    )


@login_required
@never_cache
def award_detail(request, award_id):
    award = get_object_or_404(visible_awards(request.user), pk=award_id)
    return render(request, "proofpay/award_detail.html", award_context(request, award))


@login_required
@require_POST
def prepare_payout(request, award_id):
    award = get_object_or_404(visible_awards(request.user), pk=award_id)
    require_award_role(request.user, award, {ProgramMember.Role.SPONSOR})
    return JsonResponse(
        {"detail": "Payout preparation is not available yet."}, status=501
    )


def award_context(request, award, form=None):
    latest = award.evidence_versions.first()
    recipient = (
        award.recipient_member.user_id == request.user.pk
        and award.recipient_member.active
    )
    verifier = (
        award.verifier_member.user_id == request.user.pk
        and award.verifier_member.active
    )
    return {
        "award": award,
        "latest": latest,
        "versions": award.evidence_versions.prefetch_related("files"),
        "reviews": award.review_actions.select_related("evidence"),
        "is_recipient": recipient,
        "is_verifier": verifier,
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
