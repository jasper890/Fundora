import tempfile
from pathlib import Path
from unittest.mock import patch
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings, TestCase
from proofpay.tests import test_permissions as fixtures
from proofpay.evidence import store_evidence, verify_evidence
from proofpay.reviews import record_review_request
from proofpay.models import EvidenceVersion, ReviewAction, Award


class EvidenceTests(TestCase):
    member = fixtures.AwardPermissionTests.member

    def setUp(self):
        fixtures.AwardPermissionTests.setUp(self)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.settings_override = override_settings(
            PRIVATE_EVIDENCE_ROOT=Path(self.temp.name)
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.award.status = Award.Status.FUNDED
        self.award.save()

    def upload(
        self, body=b"%PDF-1.7 synthetic", name="record.pdf", mime="application/pdf"
    ):
        upload = SimpleUploadedFile(name, body, content_type=mime)
        upload._name = name
        return upload

    def save_evidence(self, **kwargs):
        return store_evidence(
            self.recipient,
            self.award,
            [kwargs.pop("file", self.upload())],
            "Synthetic completion",
            "Organizer record",
            **kwargs,
        )

    def test_commitment_changes_for_revision_nonce_and_bytes(self):
        first = self.save_evidence()
        second = self.save_evidence()
        third = self.save_evidence(file=self.upload(b"%PDF-1.7 different"))
        self.assertEqual([first.revision, second.revision, third.revision], [1, 2, 3])
        self.assertEqual(len({first.digest, second.digest, third.digest}), 3)
        self.assertNotEqual(first.nonce, second.nonce)
        verify_evidence(first)

    def test_unsafe_uploads_leave_no_rows_or_files(self):
        for upload in [
            self.upload(b"<html>bad</html>"),
            self.upload(name="..\\bad.pdf"),
            self.upload(name="bad.html"),
            self.upload(mime="image/png"),
            self.upload(b"%PDF-" + b"x" * (5 * 1024 * 1024)),
        ]:
            with self.subTest(name=upload.name):
                with self.assertRaises(ValidationError):
                    self.save_evidence(file=upload)
        self.assertEqual(EvidenceVersion.objects.count(), 0)
        self.assertEqual(list(Path(self.temp.name).rglob("*.bin")), [])

    def test_private_download_and_confirmed_rotation(self):
        evidence = self.save_evidence()
        url = f"/evidence/{evidence.pk}/download/"
        self.assertEqual(self.client.get(url).status_code, 302)
        self.client.force_login(self.verifier)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(b"".join(response.streaming_content), b"%PDF-1.7 synthetic")
        from django.contrib.auth import get_user_model

        new_user = get_user_model().objects.create_user("replacement")
        replacement = self.member(new_user, "VERIFIER")
        self.client.force_login(new_user)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.award.verifier_member = replacement
        self.award.save()
        self.client.force_login(self.verifier)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_login(new_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        b"".join(response.streaming_content)

    def test_corrupted_file_and_immutable_version(self):
        evidence = self.save_evidence()
        evidence.explanation = "changed"
        with self.assertRaises(ValidationError):
            evidence.save()
        entry = evidence.files.get()
        (Path(self.temp.name) / entry.storage_name).write_bytes(b"corrupt")
        with self.assertRaises(ValidationError):
            verify_evidence(evidence)

    def confirm(self, evidence):
        self.award.status = "SUBMITTED"
        self.award.evidence_revision = evidence.revision
        self.award.evidence_digest = evidence.digest
        self.award.last_confirmed_ledger = 123
        self.award.save()

    def test_review_requires_matching_confirmed_evidence_and_version(self):
        first = self.save_evidence()
        with self.assertRaises(ValidationError):
            record_review_request(
                self.verifier,
                self.award,
                first,
                "APPROVE",
                "Checked",
                expected_version=0,
                source_check_method="Organizer",
            )
        self.confirm(first)
        action = record_review_request(
            self.verifier,
            self.award,
            first,
            "APPROVE",
            "Checked",
            expected_version=0,
            source_check_method="Organizer",
        )
        self.assertEqual(action.status, "PENDING")
        self.award.refresh_from_db()
        self.assertEqual(self.award.status, "SUBMITTED")
        second = self.save_evidence()
        with self.assertRaises(ValidationError):
            record_review_request(
                self.verifier,
                self.award,
                first,
                "APPROVE",
                "Checked",
                expected_version=0,
                source_check_method="Organizer",
            )
        self.assertEqual(ReviewAction.objects.count(), 1)

    def test_stale_tab_returns_conflict(self):
        evidence = self.save_evidence()
        self.confirm(evidence)
        self.client.force_login(self.verifier)
        self.award.version = 1
        self.award.save()
        response = self.client.post(
            f"/awards/{self.award.pk}/request-changes/",
            {
                "evidence_id": str(evidence.pk),
                "expected_version": 0,
                "rationale": "Check again",
                "source_check_method": "Organizer",
            },
        )
        self.assertEqual(response.status_code, 409)
        self.assertContains(response, "changed", status_code=409)
        self.assertFalse(ReviewAction.objects.exists())

    def test_stale_upload_and_file_count(self):
        first = self.save_evidence(expected_revision=0)
        with self.assertRaises(ValidationError):
            self.save_evidence(expected_revision=0)
        with self.assertRaises(ValidationError):
            store_evidence(
                self.recipient,
                self.award,
                [self.upload() for _ in range(4)],
                "done",
                "source",
            )
        self.assertEqual(EvidenceVersion.objects.count(), 1)

    def test_wrong_role_and_corrupt_review(self):
        from django.core.exceptions import PermissionDenied

        evidence = self.save_evidence()
        self.confirm(evidence)
        with self.assertRaises(PermissionDenied):
            record_review_request(
                self.sponsor,
                self.award,
                evidence,
                "APPROVE",
                "checked",
                expected_version=0,
                source_check_method="Organizer",
            )
        entry = evidence.files.get()
        (Path(self.temp.name) / entry.storage_name).write_bytes(b"changed")
        with self.assertRaises(ValidationError):
            record_review_request(
                self.verifier,
                self.award,
                evidence,
                "APPROVE",
                "checked",
                expected_version=0,
                source_check_method="Organizer",
            )
        self.assertFalse(ReviewAction.objects.exists())

    def test_upload_endpoint_preserves_errors_and_escapes_explanation(self):
        self.client.force_login(self.recipient)
        response = self.client.post(
            f"/awards/{self.award.pk}/evidence/",
            {
                "expected_revision": 0,
                "explanation": "<script>alert(1)</script>",
                "source_ref": "Synthetic source",
                "files": self.upload(),
            },
        )
        self.assertEqual(response.status_code, 302)
        response = self.client.get(response.url)
        self.assertContains(response, "&lt;script&gt;")
        self.assertNotContains(response, "<script>alert(1)</script>")
        response = self.client.post(
            f"/awards/{self.award.pk}/evidence/",
            {
                "expected_revision": 0,
                "explanation": "new",
                "source_ref": "Synthetic source",
                "files": self.upload(),
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_dispute_and_request_changes_do_not_mutate_award(self):
        evidence = self.save_evidence()
        self.confirm(evidence)
        for actor, action in [
            (self.recipient, "DISPUTE"),
            (self.verifier, "REQUEST_CHANGES"),
        ]:
            record_review_request(
                actor,
                self.award,
                evidence,
                action,
                "Please check",
                expected_version=0,
                source_check_method="Organizer",
            )
        self.award.refresh_from_db()
        self.assertEqual(self.award.status, "SUBMITTED")
        self.assertEqual(self.award.version, 0)
        self.assertEqual(ReviewAction.objects.count(), 2)

    def test_storage_cleanup_on_database_failure(self):
        with patch(
            "proofpay.evidence.EvidenceFile.objects.create",
            side_effect=RuntimeError("database failed"),
        ):
            with self.assertRaises(RuntimeError):
                self.save_evidence()
        self.assertFalse(EvidenceVersion.objects.exists())
        self.assertEqual(list(Path(self.temp.name).glob("*.bin")), [])

    def test_canonical_commitment_changes_with_nonce_only(self):
        import hashlib
        from proofpay.evidence import canonical_manifest

        evidence = self.save_evidence()
        before = evidence.digest
        evidence.nonce = "ab" * 32
        self.assertNotEqual(
            hashlib.sha256(canonical_manifest(evidence)).hexdigest(), before
        )

    def test_csrf_and_malformed_review_id(self):
        from django.test import Client

        secure = Client(enforce_csrf_checks=True)
        secure.force_login(self.recipient)
        self.assertEqual(
            secure.post(f"/awards/{self.award.pk}/evidence/", {}).status_code, 403
        )
        self.client.force_login(self.verifier)
        self.assertEqual(
            self.client.post(
                f"/awards/{self.award.pk}/review/", {"evidence_id": "invalid"}
            ).status_code,
            404,
        )
