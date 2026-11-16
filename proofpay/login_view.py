from django.contrib import messages
from django.contrib.auth.views import LoginView
from django.http import Http404
from django.shortcuts import render

from proofpay.forms import ProvisionedAuthenticationForm
from proofpay.models import ProgramMember


DOOR_ORDER = (
    ProgramMember.Role.SPONSOR,
    ProgramMember.Role.VERIFIER,
    ProgramMember.Role.RECIPIENT,
)

DOORS = {
    "sponsor": {
        "slug": "sponsor",
        "role": ProgramMember.Role.SPONSOR,
        "title": "Sponsor sign-in",
        "sentence": "For the person who funds the award and releases payment after approval.",
        "link": "Fund the award and release payment after approval.",
    },
    "verifier": {
        "slug": "verifier",
        "role": ProgramMember.Role.VERIFIER,
        "title": "Verifier sign-in",
        "sentence": "For the person who checks the completion record. Approval is not a payment.",
        "link": "Check the completion record. Approval is not a payment.",
    },
    "recipient": {
        "slug": "recipient",
        "role": ProgramMember.Role.RECIPIENT,
        "title": "Recipient sign-in",
        "sentence": "For the person who adds completion evidence and follows the stipend record.",
        "link": "Add completion evidence and follow the stipend record.",
    },
}

ROLE_NAMES = {
    ProgramMember.Role.SPONSOR: "sponsor",
    ProgramMember.Role.VERIFIER: "verifier",
    ProgramMember.Role.RECIPIENT: "recipient",
}


def assigned_role_notice(user, door: str) -> str | None:
    found = set(
        ProgramMember.objects.filter(user=user, active=True).values_list(
            "role", flat=True
        )
    )
    if DOORS[door]["role"] in found:
        return None
    names = [ROLE_NAMES[role] for role in DOOR_ORDER if role in found]
    if not names:
        return "This account has no assigned role. Showing the workspace it can open."
    if len(names) == 1:
        listed = f"a {names[0]}"
    elif len(names) == 2:
        listed = f"a {names[0]} and a {names[1]}"
    else:
        listed = ", ".join(f"a {name}" for name in names[:-1]) + f", and a {names[-1]}"
    return f"This account is {listed}. Showing that workspace."


class RoleLoginView(LoginView):
    form_class = ProvisionedAuthenticationForm
    template_name = "registration/login.html"

    def setup(self, request, *args, **kwargs):
        super().setup(request, *args, **kwargs)
        self.door = kwargs.get("door")
        if self.door is not None and self.door not in DOORS:
            raise Http404

    def get(self, request, *args, **kwargs):
        if self.door:
            return super().get(request, *args, **kwargs)
        return render(
            request,
            "registration/login_chooser.html",
            {"next": self.get_redirect_url(), "doors": [DOORS[key] for key in ("sponsor", "verifier", "recipient")]},
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["door"] = DOORS.get(self.door)
        context["next"] = self.get_redirect_url()
        return context

    def form_valid(self, form):
        if self.door:
            notice = assigned_role_notice(form.get_user(), self.door)
            if notice:
                messages.info(self.request, notice)
        return super().form_valid(form)
