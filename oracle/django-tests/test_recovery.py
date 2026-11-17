import io
import json
from datetime import timedelta
from unittest.mock import patch
from pathlib import Path
from django.test import TestCase
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management import call_command
from django.utils import timezone
from proofpay.tests import test_chain as chain_fixtures, test_evidence as evidence_fixtures, test_permissions as permission_fixtures
from proofpay.models import Award, Program, EvidenceVersion, ChainOperation
from proofpay.recovery import refresh_award, purge_evidence
from proofpay.exports import export_program
from proofpay.chain import ChainError

class RecoveryTests(TestCase):
    member=permission_fixtures.AwardPermissionTests.member
    setUp=chain_fixtures.ChainTests.setUp
    prepare=chain_fixtures.ChainTests.prepare
    signed=chain_fixtures.ChainTests.signed
    def test_restart_rebuilds_verified_snapshot(self):
        Award.objects.filter(pk=self.award.pk).update(status="CREATED",version=0)
        refreshed=refresh_award(Award.objects.get(pk=self.award.pk))
        self.assertEqual(refreshed.status,"APPROVED")
        self.assertEqual(refreshed.version,3)
        self.assertEqual(refreshed.last_confirmed_ledger,123)
    def test_reset_preserves_paid_state_and_contract(self):
        self.award.status="PAID"
        self.award.save()
        self.rpc.read_award=lambda award: (_ for _ in ()).throw(ChainError("DEPLOYMENT_UNAVAILABLE"))
        refresh_award(self.award)
        self.award.refresh_from_db()
        self.assertEqual(self.award.status,"PAID")
        self.assertEqual(self.award.contract_id,chain_fixtures.Address.from_raw_contract(b"a"*32).address)
        self.assertEqual(self.award.deployment_error,"DEPLOYMENT_UNAVAILABLE")
        self.assertFalse(ChainOperation.objects.exists())
    def test_regressed_snapshot_does_not_reset_award(self):
        self.rpc.state.update(status="CREATED",version=0)
        refresh_award(self.award)
        self.award.refresh_from_db()
        self.assertEqual(self.award.status,"APPROVED")
        self.assertEqual(self.award.version,3)

class AuditRetentionTests(TestCase):
    member=permission_fixtures.AwardPermissionTests.member
    setUp=evidence_fixtures.EvidenceTests.setUp
    upload=evidence_fixtures.EvidenceTests.upload
    save_evidence=evidence_fixtures.EvidenceTests.save_evidence
    def test_export_scope_formula_and_private_content(self):
        evidence=self.save_evidence()
        self.program.title="=HYPERLINK(unsafe)"
        self.program.save()
        response=export_program(self.sponsor,self.program,"csv")
        text=response.content.decode()
        self.assertIn("'=HYPERLINK",text)
        for private in ("Synthetic completion","Organizer record",evidence.nonce,"storage_name","signed_xdr"):
            self.assertNotIn(private,text)
        with self.assertRaises(PermissionDenied): export_program(self.recipient,self.program,"json")
        self.client.force_login(self.recipient)
        self.assertEqual(self.client.get(f"/programs/{self.program.pk}/export/").status_code,403)
    def test_purge_preview_and_settlement_cutoff_preserve_financial_rows(self):
        evidence=self.save_evidence()
        original_digest=evidence.digest
        entry=evidence.files.get()
        path=Path(self.temp.name)/entry.storage_name
        self.award.status="PAID"
        self.award.settled_at=timezone.now()-timedelta(days=31)
        self.award.save()
        result=purge_evidence(self.program,execute=False)
        self.assertEqual(result,1)
        self.assertTrue(path.exists())
        self.assertIsNone(EvidenceVersion.objects.get(pk=evidence.pk).purged_at)
        purge_evidence(self.program,execute=True)
        evidence.refresh_from_db()
        self.assertIsNotNone(evidence.purged_at)
        self.assertEqual(evidence.explanation,"")
        self.assertEqual(evidence.digest,original_digest)
        self.assertFalse(path.exists())
        self.assertTrue(Award.objects.filter(pk=self.award.pk,status="PAID").exists())
        self.assertEqual(purge_evidence(self.program,execute=True),0)
    def test_unpaid_and_recent_settlement_never_purged(self):
        evidence=self.save_evidence()
        for status,age in (("FUNDED",100),("SUBMITTED",100),("REJECTED",100),("PAID",29),("REFUNDED",29)):
            self.award.status=status
            self.award.settled_at=timezone.now()-timedelta(days=age)
            self.award.save()
            self.assertEqual(purge_evidence(self.program,execute=True),0)
        self.assertTrue((Path(self.temp.name)/evidence.files.get().storage_name).exists())

class DemoSeedTests(TestCase):
    def test_seed_has_ten_distinct_recipients_and_rerun_preserves_awards(self):
        out=io.StringIO()
        call_command("seed_demo",preview=True,prefix="test-demo",stdout=out)
        program=Program.objects.get(title="Synthetic ProofPay workshop (test-demo)")
        awards=list(program.awards.all())
        self.assertEqual(len(awards),10)
        wallets=list(program.members.values_list("public_wallet",flat=True))
        self.assertEqual(len(set(wallets)),12)
        self.assertTrue(all(not member.user.has_usable_password() for member in program.members.select_related("user")))
        ids={a.pk for a in awards}
        awards[0].status="FUNDED"
        awards[0].save()
        call_command("seed_demo",preview=True,prefix="test-demo",stdout=out)
        self.assertEqual(set(program.awards.values_list("pk",flat=True)),ids)
        self.assertEqual(program.awards.get(pk=awards[0].pk).status,"FUNDED")


    def test_seed_rejects_private_or_duplicate_wallet_material(self):
        import tempfile
        from django.core.management.base import CommandError
        with tempfile.TemporaryDirectory() as folder:
            mapping=Path(folder)/"wallets.json"
            mapping.write_text(json.dumps({"sponsor":"S-not-a-public-key","verifier":"S-other","recipients":["S-other"]*10}))
            with self.assertRaises(CommandError): call_command("seed_demo",prefix="unsafe",wallet_map=str(mapping),stdout=io.StringIO())
        self.assertFalse(Program.objects.exists())
