from collections.abc import Iterable

from django.contrib.auth.models import AbstractBaseUser
from django.core.exceptions import PermissionDenied
from django.db.models import Q, QuerySet

from proofpay.models import Award, ProgramMember


def visible_awards(user: AbstractBaseUser) -> QuerySet[Award]:
    if not user.is_authenticated:
        return Award.objects.none()
    return Award.objects.filter(
        Q(
            sponsor_member__user_id=user.pk,
            sponsor_member__role=ProgramMember.Role.SPONSOR,
            sponsor_member__active=True,
        )
        | Q(
            verifier_member__user_id=user.pk,
            verifier_member__role=ProgramMember.Role.VERIFIER,
            verifier_member__active=True,
        )
        | Q(
            recipient_member__user_id=user.pk,
            recipient_member__role=ProgramMember.Role.RECIPIENT,
            recipient_member__active=True,
        )
    ).distinct()


def require_award_role(
    user: AbstractBaseUser,
    award: Award,
    allowed_roles: Iterable[str],
) -> ProgramMember:
    if not user.is_authenticated:
        raise PermissionDenied

    role_members = {
        ProgramMember.Role.SPONSOR: award.sponsor_member,
        ProgramMember.Role.VERIFIER: award.verifier_member,
        ProgramMember.Role.RECIPIENT: award.recipient_member,
    }
    for role in allowed_roles:
        member = role_members.get(role)
        if (
            member is not None
            and member.user_id == user.pk
            and member.role == role
            and member.active
        ):
            return member
    raise PermissionDenied
