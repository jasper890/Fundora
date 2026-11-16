from proofpay.models import ProgramMember


ROLE_LABELS = {
    ProgramMember.Role.SPONSOR: "Sponsor",
    ProgramMember.Role.VERIFIER: "Verifier",
    ProgramMember.Role.RECIPIENT: "Recipient",
}


def workspace(request):
    if not getattr(request, "user", None) or not request.user.is_authenticated:
        return {"workspace_role_label": ""}
    roles = list(
        ProgramMember.objects.filter(user=request.user, active=True)
        .values_list("role", flat=True)
        .distinct()
    )
    if len(roles) == 1:
        return {"workspace_role_label": ROLE_LABELS.get(roles[0], roles[0].title())}
    if len(roles) > 1:
        return {"workspace_role_label": "Multiple roles"}
    return {"workspace_role_label": ""}
