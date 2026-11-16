from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone
from stellar_sdk import Keypair

from proofpay.forms import ProvisionedAuthenticationForm
from proofpay.models import Award, LoginAttempt, Program, ProgramMember, create_award
from proofpay.permissions import require_award_role, visible_awards


User = get_user_model()


class AwardPermissionTests(TestCase):
    def setUp(self):
        self.sponsor = User.objects.create_user("sponsor")
        self.verifier = User.objects.create_user("verifier")
        self.recipient = User.objects.create_user("recipient")
        self.program = Program.objects.create(
            title="Synthetic workshop",
            requirements_text="Complete the workshop",
            requirements_version=1,
            sponsor_user=self.sponsor,
            verifier_user=self.verifier,
            claim_deadline=timezone.now() + timedelta(days=7),
            review_deadline=timezone.now() + timedelta(days=9),
            payout_deadline=timezone.now() + timedelta(days=10),
        )
        self.sponsor_member = self.member(self.sponsor, ProgramMember.Role.SPONSOR)
        self.verifier_member = self.member(self.verifier, ProgramMember.Role.VERIFIER)
        self.recipient_member = self.member(self.recipient, ProgramMember.Role.RECIPIENT)
        self.award = create_award(
            self.program,
            sponsor=self.sponsor_member,
            verifier=self.verifier_member,
            recipient=self.recipient_member,
        )

    def member(self, user, role, wallet=None):
        return ProgramMember.objects.create(
            program=self.program,
            user=user,
            role=role,
            public_wallet=wallet or Keypair.random().public_key,
        )

    def test_anonymous_private_pages_redirect_to_login(self):
        for url in (
            reverse("program_list"),
            reverse("award_detail", args=(self.award.pk,)),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertRedirects(response, f"/login/?next={url}", fetch_redirect_response=False)

    def test_program_list_does_not_label_unconfirmed_award_as_funded(self):
        self.award.status = Award.Status.FUNDED
        self.award.save(update_fields=("status",))
        self.client.force_login(self.recipient)

        response = self.client.get(reverse("program_list"))

        self.assertContains(response, "Not confirmed on-chain")
        self.assertContains(response, "Recipient")
        self.assertContains(response, 'class="role-label"')

    def test_unrelated_program_participant_gets_404(self):
        unrelated = User.objects.create_user("unrelated")
        unrelated_member = self.member(unrelated, ProgramMember.Role.RECIPIENT)
        create_award(
            self.program,
            sponsor=self.sponsor_member,
            verifier=self.verifier_member,
            recipient=unrelated_member,
        )
        self.client.force_login(unrelated)

        response = self.client.get(reverse("award_detail", args=(self.award.pk,)))

        self.assertEqual(response.status_code, 404)
        self.assertNotIn(self.award, visible_awards(unrelated))

    def test_staff_without_sponsor_assignment_cannot_prepare_payout(self):
        self.recipient.is_staff = True
        self.recipient.save(update_fields=("is_staff",))
        self.client.force_login(self.recipient)

        response = self.client.post(reverse("prepare_payout", args=(self.award.pk,)))

        self.assertEqual(response.status_code, 403)
        with self.assertRaises(PermissionDenied):
            require_award_role(self.recipient, self.award, {ProgramMember.Role.SPONSOR})

    def test_payout_write_requires_csrf(self):
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.sponsor)

        response = csrf_client.post(reverse("prepare_payout", args=(self.award.pk,)))

        self.assertEqual(response.status_code, 403)

    def test_program_member_user_and_wallet_are_unique(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            ProgramMember.objects.create(
                program=self.program,
                user=self.recipient,
                role=ProgramMember.Role.VERIFIER,
                public_wallet=Keypair.random().public_key,
            )

        other_user = User.objects.create_user("other")
        with self.assertRaises(IntegrityError), transaction.atomic():
            ProgramMember.objects.create(
                program=self.program,
                user=other_user,
                role=ProgramMember.Role.RECIPIENT,
                public_wallet=self.recipient_member.public_wallet,
            )

    def test_award_rejects_reusing_one_member_for_verifier_and_recipient(self):
        with self.assertRaises(ValidationError):
            create_award(
                self.program,
                sponsor=self.sponsor_member,
                verifier=self.verifier_member,
                recipient=self.verifier_member,
            )

        with self.assertRaises(IntegrityError), transaction.atomic():
            Award.objects.create(
                program=self.program,
                sponsor_member=self.sponsor_member,
                verifier_member=self.verifier_member,
                recipient_member=self.verifier_member,
            )

    def test_award_rejects_members_from_another_program(self):
        other_program = Program.objects.create(
            title="Other workshop",
            requirements_text="Complete another workshop",
            requirements_version=1,
            sponsor_user=self.sponsor,
            verifier_user=self.verifier,
                claim_deadline=timezone.now() + timedelta(days=7),
                review_deadline=timezone.now() + timedelta(days=9),
                payout_deadline=timezone.now() + timedelta(days=10),
        )

        with self.assertRaises(ValidationError):
            create_award(
                other_program,
                sponsor=self.sponsor_member,
                verifier=self.verifier_member,
                recipient=self.recipient_member,
            )

    def test_award_rejects_invalid_classic_wallet_address(self):
        invalid_recipient = self.member(
            User.objects.create_user("bad-wallet"),
            ProgramMember.Role.RECIPIENT,
            "Gnot-an-address",
        )

        with self.assertRaises(ValidationError):
            create_award(
                self.program,
                sponsor=self.sponsor_member,
                verifier=self.verifier_member,
                recipient=invalid_recipient,
            )

    def test_award_rejects_inactive_role_member(self):
        inactive_recipient = self.member(
            User.objects.create_user("inactive-recipient"),
            ProgramMember.Role.RECIPIENT,
        )
        inactive_recipient.active = False
        inactive_recipient.save(update_fields=("active",))

        with self.assertRaises(ValidationError):
            create_award(
                self.program,
                sponsor=self.sponsor_member,
                verifier=self.verifier_member,
                recipient=inactive_recipient,
            )


class ProvisionedLoginTests(TestCase):
    def test_password_change_page_requires_login(self):
        response = self.client.get(reverse("password_change"))

        self.assertRedirects(
            response,
            f"/login/?next={reverse('password_change')}",
            fetch_redirect_response=False,
        )

    def test_five_failed_attempts_block_login_until_the_window_expires(self):
        user = User.objects.create_user("rate-limited", password="a-strong-test-password")

        for index in range(5):
            response = self.client.post(
                reverse("login"),
                {"username": user.username, "password": "wrong-password"},
                REMOTE_ADDR="192.0.2.10",
            )
            self.assertEqual(response.status_code, 200)
            if index == 0:
                self.assertIsInstance(response.context["form"], ProvisionedAuthenticationForm)

        bucket = LoginAttempt.objects.get()
        self.assertEqual(bucket.failed_attempts, 5)
        self.assertEqual(len(bucket.account_ip_digest), 64)
        self.assertNotIn("192.0.2.10", bucket.account_ip_digest)

        other_ip = Client()
        allowed_from_other_ip = other_ip.post(
            reverse("login"),
            {"username": user.username, "password": "a-strong-test-password"},
            REMOTE_ADDR="192.0.2.11",
        )
        self.assertEqual(allowed_from_other_ip.status_code, 302)

        blocked = self.client.post(
            reverse("login"),
            {"username": user.username, "password": "a-strong-test-password"},
            REMOTE_ADDR="192.0.2.10",
        )
        self.assertEqual(blocked.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

        LoginAttempt.objects.filter(account_ip_digest=bucket.account_ip_digest).update(
            window_started_at=timezone.now() - timedelta(minutes=16),
            last_attempt_at=timezone.now() - timedelta(minutes=16),
        )
        allowed = self.client.post(
            reverse("login"),
            {"username": user.username, "password": "a-strong-test-password"},
            REMOTE_ADDR="192.0.2.10",
        )
        self.assertEqual(allowed.status_code, 302)
        self.assertIn("_auth_user_id", self.client.session)
        bucket = LoginAttempt.objects.get(account_ip_digest=bucket.account_ip_digest)
        self.assertEqual(bucket.failed_attempts, 0)
        self.assertTrue(bucket.last_succeeded)


class RoleDoorTests(TestCase):
    password = "a-strong-test-password"

    def setUp(self):
        fixture = AwardPermissionTests()
        fixture.setUp()
        self.client = Client()
        self.recipient = fixture.recipient
        self.program = fixture.program
        self.award = fixture.award
        self.recipient.set_password(self.password)
        self.recipient.save(update_fields=("password",))

    def test_login_chooser_names_jobs_without_asking_for_a_password(self):
        response = self.client.get(reverse("login") + "?next=/programs/")

        self.assertContains(response, "Sponsor")
        self.assertContains(response, "Verifier")
        self.assertContains(response, "Recipient")
        self.assertContains(response, "Fund the award and release payment after approval.")
        self.assertNotContains(response, "Password")
        self.assertContains(response, "/login/sponsor/?next=/programs/")

    def test_wrong_door_signs_in_without_granting_that_role(self):
        response = self.client.post(
            reverse("login_door", kwargs={"door": "sponsor"}),
            {"username": self.recipient.username, "password": self.password},
            follow=True,
        )

        self.assertEqual(response.redirect_chain, [("/programs/", 302)])
        self.assertContains(
            response, "This account is a recipient. Showing that workspace."
        )
        self.assertEqual(
            self.client.get(
                reverse("program_export", args=(self.program.pk,))
            ).status_code,
            403,
        )
        denied = self.client.post(
            reverse("prepare_action", args=(self.award.pk, "DEPLOY")),
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.json()["error"], "ACTION_DENIED")

    def test_failed_password_stays_on_the_same_door(self):
        response = self.client.post(
            reverse("login_door", kwargs={"door": "recipient"}),
            {"username": self.recipient.username, "password": "wrong-password"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Recipient sign-in")
        self.assertContains(response, "Invalid username or password.")
