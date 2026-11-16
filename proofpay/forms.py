import hashlib
import hmac
from datetime import timedelta

from django import forms
from django.conf import settings
from django.contrib.auth.forms import AuthenticationForm, PasswordChangeForm
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from proofpay.models import LoginAttempt


LOGIN_WINDOW = timedelta(minutes=15)
MAX_LOGIN_FAILURES = 5


def _account_ip_digest(username: str, remote_addr: str) -> str:
    message = f"{username.strip().casefold()}\0{remote_addr}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


class ProvisionedAuthenticationForm(AuthenticationForm):
    error_messages = {
        "invalid_login": "Invalid username or password.",
        "inactive": "This account is inactive.",
    }

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("label_suffix", "")
        super().__init__(*args, **kwargs)
        self.fields["username"].label = "Username"
        self.fields["password"].label = "Password"

    def clean(self):
        now = timezone.now()
        cutoff = now - LOGIN_WINDOW
        LoginAttempt.objects.filter(last_attempt_at__lt=cutoff).delete()
        digest = _account_ip_digest(
            self.cleaned_data.get("username", ""),
            self.request.META.get("REMOTE_ADDR", ""),
        )
        authentication_error: ValidationError | None = None

        with transaction.atomic():
            attempt, _ = LoginAttempt.objects.select_for_update().get_or_create(
                account_ip_digest=digest,
                defaults={"window_started_at": now, "last_attempt_at": now},
            )
            if attempt.window_started_at <= cutoff:
                attempt.window_started_at = now
                attempt.failed_attempts = 0
            if attempt.failed_attempts >= MAX_LOGIN_FAILURES:
                raise ValidationError(
                    "Too many failed attempts. Try again in 15 minutes.",
                    code="throttled",
                )

            try:
                cleaned_data = super().clean()
            except ValidationError as error:
                attempt.failed_attempts += 1
                attempt.last_attempt_at = now
                attempt.last_succeeded = False
                attempt.save(
                    update_fields=(
                        "failed_attempts",
                        "last_attempt_at",
                        "last_succeeded",
                        "window_started_at",
                    )
                )
                authentication_error = error
            else:
                attempt.last_attempt_at = now
                attempt.last_succeeded = self.user_cache is not None
                if self.user_cache is None:
                    attempt.failed_attempts += 1
                else:
                    attempt.failed_attempts = 0
                attempt.save(
                    update_fields=(
                        "failed_attempts",
                        "last_attempt_at",
                        "last_succeeded",
                        "window_started_at",
                    )
                )

        if authentication_error is not None:
            raise authentication_error
        return cleaned_data


class EvidenceForm(forms.Form):
    explanation = forms.CharField(
        label="Explanation",
        max_length=2000,
        widget=forms.Textarea(attrs={"rows": 4}),
    )
    source_ref = forms.CharField(max_length=512, label="Original source reference")
    expected_revision = forms.IntegerField(min_value=0, widget=forms.HiddenInput)

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("label_suffix", "")
        super().__init__(*args, **kwargs)


class ProofPayPasswordChangeForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("label_suffix", "")
        super().__init__(*args, **kwargs)
        self.fields["old_password"].label = "Current password"
        self.fields["new_password1"].label = "New password"
        self.fields["new_password2"].label = "Confirm new password"
