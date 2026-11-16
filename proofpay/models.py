import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import F, Q
from stellar_sdk import StrKey


class Program(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=160)
    requirements_text = models.TextField()
    requirements_version = models.PositiveIntegerField(default=1)
    sponsor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sponsored_programs",
    )
    verifier_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="verifier_programs",
    )
    claim_deadline = models.DateTimeField()
    review_deadline = models.DateTimeField()
    payout_deadline = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(requirements_version__gt=0),
                name="program_requirements_version_positive",
            ),
            models.CheckConstraint(
                condition=Q(claim_deadline__lt=F("review_deadline"))
                & Q(review_deadline__lt=F("payout_deadline")),
                name="program_deadlines_ordered",
            ),
        ]

    def __str__(self):
        return self.title


class ProgramMember(models.Model):
    class Role(models.TextChoices):
        SPONSOR = "SPONSOR", "Sponsor"
        VERIFIER = "VERIFIER", "Verifier"
        RECIPIENT = "RECIPIENT", "Recipient"

    program = models.ForeignKey(
        Program, on_delete=models.PROTECT, related_name="members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="program_memberships",
    )
    role = models.CharField(max_length=12, choices=Role.choices)
    public_wallet = models.CharField(max_length=56)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("program", "user"), name="member_unique_user_per_program"
            ),
            models.UniqueConstraint(
                fields=("program", "public_wallet"),
                name="member_unique_wallet_per_program",
            ),
        ]


class Award(models.Model):
    class Status(models.TextChoices):
        CREATED = "CREATED", "Created"
        FUNDED = "FUNDED", "Funded"
        SUBMITTED = "SUBMITTED", "Submitted"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        PAID = "PAID", "Paid"
        REFUNDED = "REFUNDED", "Refunded"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        Program, on_delete=models.PROTECT, related_name="awards"
    )
    sponsor_member = models.ForeignKey(
        ProgramMember, on_delete=models.PROTECT, related_name="sponsored_awards"
    )
    verifier_member = models.ForeignKey(
        ProgramMember, on_delete=models.PROTECT, related_name="verified_awards"
    )
    recipient_member = models.ForeignKey(
        ProgramMember, on_delete=models.PROTECT, related_name="received_awards"
    )
    contract_id = models.CharField(max_length=56, unique=True, null=True, blank=True)
    network_id = models.CharField(max_length=128, blank=True)
    code_hash = models.CharField(max_length=64, blank=True)
    token_id = models.CharField(max_length=56, blank=True)
    base_units = models.BigIntegerField(default=200_000_000)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.CREATED
    )
    version = models.PositiveBigIntegerField(default=0)
    evidence_revision = models.PositiveIntegerField(default=0)
    evidence_digest = models.CharField(max_length=64, blank=True)
    last_confirmed_ledger = models.PositiveBigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("program", "recipient_member"),
                name="award_unique_recipient_per_program",
            ),
            models.CheckConstraint(
                condition=~Q(sponsor_member=F("verifier_member"))
                & ~Q(sponsor_member=F("recipient_member"))
                & ~Q(verifier_member=F("recipient_member")),
                name="award_distinct_role_members",
            ),
            models.CheckConstraint(
                condition=Q(base_units=200_000_000), name="award_fixed_base_units"
            ),
        ]


@transaction.atomic
def create_award(program, *, sponsor, verifier, recipient):
    members = (sponsor, verifier, recipient)
    expected_roles = (
        ProgramMember.Role.SPONSOR,
        ProgramMember.Role.VERIFIER,
        ProgramMember.Role.RECIPIENT,
    )
    if any(member.program_id != program.pk for member in members):
        raise ValidationError("All award members must belong to its program.")
    if tuple(member.role for member in members) != expected_roles:
        raise ValidationError("Each award member must have the assigned role.")
    if any(not member.active for member in members):
        raise ValidationError(
            "Inactive program members cannot be assigned to an award."
        )
    if any(
        not StrKey.is_valid_ed25519_public_key(member.public_wallet)
        for member in members
    ):
        raise ValidationError(
            "Each award member must have a valid classic Stellar account address."
        )
    if (
        len({member.user_id for member in members}) != 3
        or len({member.public_wallet for member in members}) != 3
    ):
        raise ValidationError("Award roles require distinct users and wallets.")
    if (
        sponsor.user_id != program.sponsor_user_id
        or verifier.user_id != program.verifier_user_id
    ):
        raise ValidationError(
            "Award sponsor and initial verifier must match the program assignments."
        )
    return Award.objects.create(
        program=program,
        sponsor_member=sponsor,
        verifier_member=verifier,
        recipient_member=recipient,
    )


class LoginAttempt(models.Model):
    account_ip_digest = models.CharField(max_length=64, unique=True)
    window_started_at = models.DateTimeField()
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    last_attempt_at = models.DateTimeField()
    last_succeeded = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=("last_attempt_at",), name="login_last_attempt_idx")
        ]


class EvidenceVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    award = models.ForeignKey(
        Award, on_delete=models.PROTECT, related_name="evidence_versions"
    )
    revision = models.PositiveIntegerField()
    nonce = models.CharField(max_length=64)
    manifest = models.TextField()
    digest = models.CharField(max_length=64)
    explanation = models.TextField()
    source_ref = models.CharField(max_length=512)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("award", "revision"), name="evidence_unique_revision"
            ),
            models.CheckConstraint(
                condition=Q(revision__gt=0), name="evidence_revision_positive"
            ),
        ]
        ordering = ("-revision",)

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError(
                "Evidence versions are immutable. Create a new revision."
            )
        return super().save(*args, **kwargs)


class EvidenceFile(models.Model):
    version = models.ForeignKey(
        EvidenceVersion, on_delete=models.PROTECT, related_name="files"
    )
    storage_name = models.CharField(max_length=80, unique=True)
    filename = models.CharField(max_length=160)
    content_type = models.CharField(max_length=32)
    size = models.PositiveIntegerField()
    digest = models.CharField(max_length=64)

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Evidence files are immutable.")
        return super().save(*args, **kwargs)


class ReviewAction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    award = models.ForeignKey(
        Award, on_delete=models.PROTECT, related_name="review_actions"
    )
    evidence = models.ForeignKey(EvidenceVersion, on_delete=models.PROTECT)
    verifier = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(
        max_length=20,
        choices=[
            (a, a.title())
            for a in ("APPROVE", "REJECT", "REOPEN", "REQUEST_CHANGES", "DISPUTE")
        ],
    )
    rationale = models.TextField()
    source_check_method = models.CharField(max_length=512, blank=True)
    expected_version = models.PositiveBigIntegerField()
    status = models.CharField(max_length=12, default="PENDING")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Review requests are append-only.")
        return super().save(*args, **kwargs)
