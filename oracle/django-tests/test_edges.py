from datetime import timedelta
from pathlib import Path
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from stellar_sdk import Keypair

from proofpay.evidence import store_evidence
from proofpay.models import Award, Program, ProgramMember, create_award


User = get_user_model()


class EdgeCopyTests(TestCase):
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
        self.sponsor_member = ProgramMember.objects.create(
            program=self.program,
            user=self.sponsor,
            role=ProgramMember.Role.SPONSOR,
            public_wallet=Keypair.random().public_key,
        )
        self.verifier_member = ProgramMember.objects.create(
            program=self.program,
            user=self.verifier,
            role=ProgramMember.Role.VERIFIER,
            public_wallet=Keypair.random().public_key,
        )
        self.recipient_member = ProgramMember.objects.create(
            program=self.program,
            user=self.recipient,
            role=ProgramMember.Role.RECIPIENT,
            public_wallet=Keypair.random().public_key,
        )
        self.award = create_award(
            self.program,
            sponsor=self.sponsor_member,
            verifier=self.verifier_member,
            recipient=self.recipient_member,
        )

    def test_login_labels_have_no_trailing_colon(self):
        response = self.client.get(reverse("login_door", args=("recipient",)))

        self.assertContains(response, '<label for="id_username">Username</label>')
        self.assertContains(response, '<label for="id_password">Password</label>')
        self.assertNotContains(response, "Username:")
        self.assertNotContains(response, "Password:")

    def test_wrong_password_keeps_invalid_login_message(self):
        User.objects.create_user("edge-user", password="a-strong-test-password")
        response = self.client.post(
            reverse("login"),
            {"username": "edge-user", "password": "wrong-password"},
        )

        self.assertContains(response, "Invalid username or password.")
        self.assertEqual(response.status_code, 200)

    def test_password_change_labels_have_no_trailing_colon(self):
        self.client.force_login(self.recipient)
        response = self.client.get(reverse("password_change"))

        self.assertContains(response, "Current password")
        self.assertContains(response, "New password")
        self.assertContains(response, "Confirm new password")
        self.assertContains(response, "This account tool is shared across roles.")
        self.assertNotContains(response, "Current password:")

    @override_settings(DEBUG=False)
    def test_missing_page_uses_calm_404(self):
        client = Client(raise_request_exception=False)
        response = client.get("/definitely-missing-page/")

        self.assertEqual(response.status_code, 404)
        self.assertContains(
            response, "That page is not available in ProofPay.", status_code=404
        )
        self.assertContains(response, "Back to programs", status_code=404)
        self.assertNotContains(response, "Traceback", status_code=404)

    def test_outsider_evidence_download_hides_private_explanation(self):
        private_text = "Synthetic workshop completion record."
        self.award.status = Award.Status.FUNDED
        self.award.save(update_fields=("status",))
        with tempfile.TemporaryDirectory() as temp:
            with override_settings(PRIVATE_EVIDENCE_ROOT=Path(temp)):
                evidence = store_evidence(
                    self.recipient,
                    self.award,
                    [
                        SimpleUploadedFile(
                            "record.pdf",
                            b"%PDF-1.7 synthetic",
                            content_type="application/pdf",
                        )
                    ],
                    private_text,
                    "Organizer register",
                )
                outsider = User.objects.create_user("outsider")
                self.client.force_login(outsider)
                response = self.client.get(
                    reverse("evidence_download", args=(evidence.pk,))
                )

                self.assertEqual(response.status_code, 404)
                self.assertNotContains(response, private_text, status_code=404)
                self.assertNotContains(response, "storage_name", status_code=404)

    def test_award_wallet_sign_button_names_varial(self):
        self.client.force_login(self.sponsor)
        response = self.client.get(reverse("award_detail", args=(self.award.pk,)))

        self.assertContains(response, "Sign this action in Varial")
        self.assertNotContains(response, "Sign this action in Freighter")

    def test_empty_evidence_names_next_actor(self):
        self.client.force_login(self.recipient)
        recipient_page = self.client.get(reverse("award_detail", args=(self.award.pk,)))
        self.assertContains(
            recipient_page,
            "Use Add a new evidence revision to attach your completion record.",
        )

        self.client.force_login(self.sponsor)
        sponsor_page = self.client.get(reverse("award_detail", args=(self.award.pk,)))
        self.assertContains(
            sponsor_page,
            "Waiting for the recipient to add a completion record after funding.",
        )
