from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from stellar_sdk import Keypair

from proofpay.models import Award, ChainOperation, Program, ProgramMember, create_award
from proofpay.presentation import next_step, status_lines, tracker_steps


User = get_user_model()


class PresentationCopyTests(TestCase):
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

    def confirm(self, status, *, sponsor_hold=False, verifier_hold=False):
        self.award.status = status
        self.award.last_confirmed_ledger = 100
        self.award.sponsor_hold = sponsor_hold
        self.award.verifier_hold = verifier_hold
        self.award.save(
            update_fields=(
                "status",
                "last_confirmed_ledger",
                "sponsor_hold",
                "verifier_hold",
            )
        )

    def test_unconfirmed_award_never_says_paid_or_funded(self):
        self.award.status = Award.Status.FUNDED
        self.award.save(update_fields=("status",))

        lines = status_lines(self.award)

        self.assertEqual(lines[0], "Not confirmed on-chain")
        self.assertIn("does not confirm funding or payment", " ".join(lines).lower())
        self.assertNotIn("Paid", " ".join(lines))
        self.assertNotIn("Funded", " ".join(lines))
        for step in tracker_steps(self.award):
            self.assertNotEqual(step["mark"], "done")

    def test_approved_confirmed_is_waiting_for_release_not_paid(self):
        self.confirm(Award.Status.APPROVED)

        lines = status_lines(self.award)

        self.assertEqual(lines[0], "Approved. Waiting for sponsor release.")
        self.assertNotIn("Paid", " ".join(lines))
        self.assertEqual(
            next_step(self.award, self.sponsor),
            "Review payment. Signing is not confirmation.",
        )
        current = next(step for step in tracker_steps(self.award) if step["mark"] == "current")
        self.assertIn("sponsor release", current["label"].lower())

    def test_paid_confirmed_names_testnet_amount(self):
        self.confirm(Award.Status.PAID)

        lines = status_lines(self.award)

        self.assertEqual(
            lines[0],
            "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
        )
        self.assertTrue(any("not a bank receipt" in line.lower() for line in lines))

    def test_hold_warning_only_when_ledger_confirmed(self):
        self.award.status = Award.Status.APPROVED
        self.award.sponsor_hold = True
        self.award.save(update_fields=("status", "sponsor_hold"))
        self.assertFalse(any("hold" in line.lower() for line in status_lines(self.award)))

        self.confirm(Award.Status.APPROVED, sponsor_hold=True)
        self.assertTrue(
            any("Review hold active. Payment is blocked." in line for line in status_lines(self.award))
        )

    def test_local_evidence_without_confirmed_submission(self):
        self.confirm(Award.Status.FUNDED)
        self.award.evidence_versions.create(
            revision=1,
            explanation="Synthetic completion",
            source_ref="Organizer register",
            digest="a" * 64,
            nonce="n" * 32,
            manifest="{}",
            author=self.recipient,
        )

        self.assertEqual(
            next_step(self.award, self.recipient),
            "Review and sign submission.",
        )
        self.assertTrue(
            any(
                "Evidence saved. Submission not yet signed." in line
                for line in status_lines(self.award)
            )
        )

    def test_unresolved_operation_keeps_confirmed_state(self):
        self.confirm(Award.Status.APPROVED)
        ChainOperation.objects.create(
            award=self.award,
            actor=self.sponsor,
            signer=self.sponsor_member.public_wallet,
            action="PAY",
            status="UNKNOWN",
            idempotency_key="00000000-0000-4000-8000-000000000001",
            reserves_source=True,
            intent={"payload": {}},
            preview={},
            expires_at=timezone.now() + timedelta(hours=1),
        )

        lines = status_lines(self.award)
        joined = " ".join(lines)
        self.assertIn("Approved. Waiting for sponsor release.", joined)
        self.assertIn("Outcome not confirmed", joined)
        self.assertNotIn("Failed", joined)

    def test_award_page_renders_status_without_private_paths(self):
        self.confirm(Award.Status.APPROVED)
        self.client.force_login(self.recipient)

        response = self.client.get(reverse("award_detail", args=(self.award.pk,)))

        self.assertContains(response, "Approved. Waiting for sponsor release.")
        self.assertContains(response, "Waiting for the sponsor to release payment.")
        self.assertNotContains(response, "Paid")
        self.assertNotContains(response, "private_evidence")
        self.assertNotContains(response, "storage_name")
