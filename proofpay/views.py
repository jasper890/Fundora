from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_POST

from proofpay.models import ProgramMember
from proofpay.permissions import require_award_role, visible_awards


@login_required
def program_list(request):
    memberships = ProgramMember.objects.filter(user=request.user, active=True).select_related("program")
    return render(request, "proofpay/program_list.html", {"memberships": memberships})


@login_required
def award_detail(request, award_id):
    award = get_object_or_404(visible_awards(request.user), pk=award_id)
    return render(request, "proofpay/award_detail.html", {"award": award})


@login_required
@require_POST
def prepare_payout(request, award_id):
    award = get_object_or_404(visible_awards(request.user), pk=award_id)
    require_award_role(request.user, award, {ProgramMember.Role.SPONSOR})
    return JsonResponse({"detail": "Payout preparation is not available yet."}, status=501)
