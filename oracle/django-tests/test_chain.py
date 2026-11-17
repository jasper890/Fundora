import uuid
from copy import deepcopy
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.utils import timezone
from stellar_sdk import Account, Keypair, Network, TransactionBuilder, scval, Address
from proofpay.tests import test_permissions as fixtures
from proofpay.models import ChainOperation, ChainObservation
from proofpay.chain import prepare_action, submit_signed, reconcile, ChainError


class FakeRPC:
    def __init__(self, award, key):
        self.award = award
        self.key = key
        self.sent = []
        self.result = {"status": "NOT_FOUND"}
        self.state = {
            "ledger": 123,
            "status": "APPROVED",
            "version": 3,
            "evidence_revision": 1,
            "evidence_digest": "aa" * 32,
            "verifier": award.verifier_member.public_wallet,
            "sponsor_hold": False,
            "verifier_hold": False,
        }

    def read_award(self, award):
        return deepcopy(self.state)

    def prepare(self, operation, snapshot):
        tx = (
            TransactionBuilder(
                Account(operation.signer, 100),
                Network.TESTNET_NETWORK_PASSPHRASE,
                base_fee=100,
            )
            .append_invoke_contract_function_op(
                Address.from_raw_contract(b"a" * 32).address,
                "pay",
                [scval.to_uint64(3)],
            )
            .set_timeout(120)
            .build()
        )
        return tx

    def submit(self, operation):
        persisted = ChainOperation.objects.get(pk=operation.pk)
        assert persisted.signed_hash and persisted.signed_xdr
        self.sent.append(persisted.signed_hash)
        return "PENDING"

    def transaction(self, operation):
        return deepcopy(self.result)


class ChainTests(TestCase):
    member = fixtures.AwardPermissionTests.member

    def setUp(self):
        fixtures.AwardPermissionTests.setUp(self)
        self.key = Keypair.random()
        self.sponsor_member.public_wallet = self.key.public_key
        self.sponsor_member.save()
        self.award.status = "APPROVED"
        self.award.version = 3
        self.award.contract_id = Address.from_raw_contract(b"a" * 32).address
        self.award.network_id = Network.TESTNET_NETWORK_PASSPHRASE
        self.award.code_hash = "bb" * 32
        self.award.save()
        self.rpc = FakeRPC(self.award, self.key)
        self.patch = patch("proofpay.chain.gateway", return_value=self.rpc)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.settings = override_settings(STELLAR_ALLOW_SUBMISSION=True)
        self.settings.enable()
        self.addCleanup(self.settings.disable)

    def prepare(self, key=None):
        return prepare_action(
            self.sponsor,
            self.award,
            "PAY",
            {"expected_version": "3", "params": {}},
            key or uuid.uuid4(),
        )

    def signed(self, operation, key=None, network=None, mutate=False):
        from stellar_sdk import TransactionEnvelope

        tx = TransactionEnvelope.from_xdr(
            operation.unsigned_xdr, network or Network.TESTNET_NETWORK_PASSPHRASE
        )
        if mutate:
            tx.transaction.fee += 1
        tx.sign(key or self.key)
        return tx.to_xdr()

    def test_same_key_returns_same_operation_changed_intent_conflicts(self):
        key = uuid.uuid4()
        one = self.prepare(key)
        self.assertEqual(self.prepare(key).pk, one.pk)
        with self.assertRaises(ChainError):
            prepare_action(
                self.sponsor,
                self.award,
                "REFUND",
                {"expected_version": "3", "params": {}},
                key,
            )

    def test_unresolved_source_blocks_fresh_payment(self):
        self.prepare()
        with self.assertRaises(ChainError):
            self.prepare()
        self.assertEqual(ChainOperation.objects.count(), 1)

    def test_wrong_signature_network_or_mutated_body_never_submits(self):
        operation = self.prepare()
        for xdr in (
            self.signed(operation, key=Keypair.random()),
            self.signed(operation, network=Network.PUBLIC_NETWORK_PASSPHRASE),
            self.signed(operation, mutate=True),
        ):
            with self.assertRaises(ChainError):
                submit_signed(self.sponsor, operation, xdr)
        self.assertEqual(self.rpc.sent, [])

    def test_pending_is_not_paid_and_signed_hash_precedes_send(self):
        operation = self.prepare()
        result = submit_signed(self.sponsor, operation, self.signed(operation))
        self.assertEqual(result.status, "SUBMITTED")
        self.award.refresh_from_db()
        self.assertEqual(self.award.status, "APPROVED")
        self.assertEqual(len(self.rpc.sent), 1)
        submit_signed(self.sponsor, operation, self.signed(operation))
        self.assertEqual(len(self.rpc.sent), 1)

    def test_timeout_and_not_found_stay_unknown(self):
        operation = self.prepare()
        self.rpc.submit = lambda op: (_ for _ in ()).throw(TimeoutError())
        result = submit_signed(self.sponsor, operation, self.signed(operation))
        self.assertEqual(result.status, "UNKNOWN")
        result = reconcile(result)
        self.assertEqual(result.status, "UNKNOWN")
        with self.assertRaises(ChainError):
            self.prepare()

    def test_confirmed_result_applies_once(self):
        operation = self.prepare()
        submit_signed(self.sponsor, operation, self.signed(operation))
        self.rpc.state.update(status="PAID", version=4)
        self.rpc.result = {
            "status": "SUCCESS",
            "ledger": 123,
            "return_value": None,
            "body_hash": operation.unsigned_hash,
        }
        self.assertEqual(reconcile(operation).status, "CONFIRMED_SUCCESS")
        self.assertEqual(reconcile(operation).status, "CONFIRMED_SUCCESS")
        self.award.refresh_from_db()
        self.assertEqual(self.award.status, "PAID")
        self.assertEqual(
            ChainObservation.objects.filter(status="CONFIRMED_SUCCESS").count(), 1
        )

    def test_success_with_wrong_post_state_stays_unknown(self):
        operation = self.prepare()
        submit_signed(self.sponsor, operation, self.signed(operation))
        self.rpc.result = {
            "status": "SUCCESS",
            "ledger": 123,
            "return_value": None,
            "body_hash": operation.unsigned_hash,
        }
        self.assertEqual(reconcile(operation).status, "UNKNOWN")
        self.award.refresh_from_db()
        self.assertEqual(self.award.status, "APPROVED")

    def test_extra_operation_destination_and_source_mutations_rejected(self):
        from stellar_sdk import TransactionEnvelope

        operation = self.prepare()
        for field in ("source", "contract", "extra"):
            tx = TransactionEnvelope.from_xdr(
                operation.unsigned_xdr, Network.TESTNET_NETWORK_PASSPHRASE
            )
            if field == "source":
                tx.transaction.source.account_id = Keypair.random().public_key
            elif field == "contract":
                tx.transaction.operations[
                    0
                ].host_function.invoke_contract.contract_address = (
                    Address.from_raw_contract(b"z" * 32).to_xdr_sc_address()
                )
            else:
                tx.transaction.operations.append(tx.transaction.operations[0])
            tx.sign(self.key)
            with self.assertRaises(ChainError):
                submit_signed(self.sponsor, operation, tx.to_xdr())
        self.assertEqual(self.rpc.sent, [])

    def test_submission_disabled_and_expired_unsigned(self):
        operation = self.prepare()
        with override_settings(STELLAR_ALLOW_SUBMISSION=False):
            with self.assertRaises(ChainError):
                submit_signed(self.sponsor, operation, self.signed(operation))
        ChainOperation.objects.filter(pk=operation.pk).update(expires_at=timezone.now())
        with self.assertRaises(ChainError):
            submit_signed(self.sponsor, operation, self.signed(operation))
        self.assertEqual(self.rpc.sent, [])

    def test_json_scope_parameter_and_auth_validation(self):
        from django.test import Client

        url = f"/awards/{self.award.pk}/prepare/pay/"
        self.assertEqual(
            self.client.post(url, {}, content_type="application/json").status_code, 401
        )
        self.client.force_login(self.recipient)
        self.assertEqual(
            self.client.post(url, {}, content_type="application/json").status_code, 403
        )
        self.client.force_login(self.sponsor)
        response = self.client.post(
            url,
            {"expected_version": "3", "params": {"recipient": "wrong"}},
            content_type="application/json",
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(response.status_code, 400)
        response = self.client.post(
            url,
            {"expected_version": "3", "params": {}},
            content_type="application/json",
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        self.assertEqual(response.status_code, 201)
        operation = ChainOperation.objects.get()
        self.client.force_login(self.recipient)
        self.assertEqual(
            self.client.post(
                f"/operations/{operation.pk}/submit/",
                {"signed_xdr": self.signed(operation)},
                content_type="application/json",
            ).status_code,
            404,
        )

    def test_fee_ceiling(self):
        original = self.rpc.prepare

        def costly(op, state):
            tx = original(op, state)
            tx.transaction.fee = 10_000_001
            return tx

        self.rpc.prepare = costly
        with self.assertRaises(ChainError) as error:
            self.prepare()
        self.assertEqual(error.exception.code, "FEE_CEILING")
        self.assertEqual(ChainOperation.objects.get().status, "ABANDONED")

    def test_failed_chain_result_refreshes_before_replacement(self):
        operation = self.prepare()
        submit_signed(self.sponsor, operation, self.signed(operation))
        self.rpc.result = {
            "status": "FAILED",
            "ledger": 123,
            "body_hash": operation.unsigned_hash,
        }
        self.assertEqual(reconcile(operation).status, "CONFIRMED_FAILED")
        self.rpc.state.update(status="PAID", version=4)
        with self.assertRaises(ChainError):
            self.prepare()

    def test_expired_unknown_payment_allows_only_eligible_refund(self):
        from datetime import timedelta

        operation = self.prepare()
        submit_signed(self.sponsor, operation, self.signed(operation))
        self.rpc.state["timestamp"] = (
            int(self.award.program.payout_deadline.timestamp()) + 1
        )
        ChainOperation.objects.filter(pk=operation.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1), status="UNKNOWN"
        )
        refund = prepare_action(
            self.sponsor,
            self.award,
            "REFUND",
            {"expected_version": "3", "params": {}},
            uuid.uuid4(),
        )
        operation.refresh_from_db()
        self.assertEqual(operation.status, "UNKNOWN")
        self.assertFalse(operation.reserves_source)
        self.assertEqual(refund.status, "PREPARED")

    def test_network_token_and_code_gates(self):
        from proofpay.chain import RPCGateway
        from types import SimpleNamespace
        from stellar_sdk import Asset

        rpc = RPCGateway()
        rpc.server = __import__("unittest.mock", fromlist=["Mock"]).Mock()
        rpc.server.get_network.return_value = SimpleNamespace(
            passphrase=Network.PUBLIC_NETWORK_PASSPHRASE
        )
        with self.assertRaises(ChainError) as error:
            rpc.verify_network()
        self.assertEqual(error.exception.code, "WRONG_NETWORK")
        operation = self.prepare()
        with (
            patch.object(
                rpc,
                "verify_network",
                return_value=Asset.native().contract_id(
                    Network.TESTNET_NETWORK_PASSPHRASE
                ),
            ),
            patch.object(rpc, "verify_code", return_value="bb" * 32),
        ):
            operation.award.token_id = Address.from_raw_contract(b"z" * 32).address
            with self.assertRaises(ChainError) as error:
                rpc.prepare(operation, self.rpc.state)
            self.assertEqual(error.exception.code, "WRONG_TOKEN")
        with override_settings(STELLAR_WASM_HASH="cc" * 32):
            with self.assertRaises(ChainError) as error:
                rpc.verify_code(self.award)
            self.assertEqual(error.exception.code, "WRONG_CODE_HASH")

    def test_missing_affirmative_source_confirmation_blocks_approval(self):
        from proofpay.models import ReviewAction, EvidenceVersion

        evidence = EvidenceVersion.objects.create(
            award=self.award,
            revision=1,
            nonce="aa" * 32,
            manifest="{}",
            digest="aa" * 32,
            explanation="synthetic",
            source_ref="record",
            author=self.recipient,
        )
        self.rpc.state["status"] = "SUBMITTED"
        ReviewAction.objects.create(
            award=self.award,
            evidence=evidence,
            verifier=self.verifier,
            action="APPROVE",
            rationale="checked",
            source_check_method="organizer",
            expected_version=3,
        )
        with patch("proofpay.chain.verify_evidence"):
            with self.assertRaises(ChainError) as error:
                prepare_action(
                    self.verifier,
                    self.award,
                    "APPROVE",
                    {"expected_version": "3", "params": {}},
                    uuid.uuid4(),
                )
        self.assertEqual(error.exception.code, "REVIEW_REQUIRED")
        ReviewAction.objects.filter(award=self.award).update(source_confirmed=True)
        with patch("proofpay.chain.verify_evidence"):
            prepared = prepare_action(
                self.verifier,
                self.award,
                "APPROVE",
                {"expected_version": "3", "params": {}},
                uuid.uuid4(),
            )
        self.assertIsNotNone(prepared.review_id)
        self.assertEqual(prepared.status, "PREPARED")

    def test_malformed_xdr_is_safe_error(self):
        operation = self.prepare()
        for value in ("broken", "AAAA", 123, ""):
            with self.assertRaises(ChainError) as error:
                submit_signed(self.sponsor, operation, value)
            self.assertEqual(error.exception.status, 400)

    def test_deployment_constructor_salt_is_frozen_and_result_bound(self):
        from proofpay.chain import (
            RPCGateway,
            constructor_manifest,
            deployment_contract_id,
        )
        from types import SimpleNamespace
        from unittest.mock import Mock
        from stellar_sdk import Asset

        self.award.contract_id = None
        self.award.deployment_manifest = constructor_manifest(self.award)
        self.award.token_id = Asset.native().contract_id(
            Network.TESTNET_NETWORK_PASSPHRASE
        )
        self.award.save()
        operation = prepare_action(
            self.sponsor, self.award, "DEPLOY", {"params": {}}, uuid.uuid4()
        )
        rpc = RPCGateway()
        rpc.server = Mock()
        rpc.server.load_account.return_value = Account(self.key.public_key, 100)
        rpc.server.get_latest_ledger.return_value = SimpleNamespace(
            close_time=int(timezone.now().timestamp())
        )
        rpc.server.prepare_transaction.side_effect = lambda tx: tx
        with (
            patch.object(rpc, "verify_network", return_value=self.award.token_id),
            patch.object(rpc, "verify_code", return_value="bb" * 32),
        ):
            tx = rpc.prepare(operation, {})
        create = tx.transaction.operations[0].host_function.create_contract_v2
        self.assertEqual(len(create.constructor_args), 10)
        self.assertEqual(
            create.contract_id_preimage.from_address.salt.uint256,
            bytes.fromhex(operation.award.deployment_manifest["salt"]),
        )
        self.assertNotEqual(
            deployment_contract_id(operation.award.deployment_manifest),
            Address.from_raw_contract(b"z" * 32).address,
        )
        submit_signed(self.sponsor, operation, self.signed(operation))
        self.rpc.result = {
            "status": "SUCCESS",
            "ledger": 123,
            "return_value": Address.from_raw_contract(b"z" * 32).address,
            "body_hash": operation.unsigned_hash,
        }
        self.assertEqual(reconcile(operation).status, "UNKNOWN")
        self.award.refresh_from_db()
        self.assertIsNone(self.award.contract_id)

    def test_unsigned_wallet_decline_abandons_but_signed_cannot(self):
        operation = self.prepare()
        self.client.force_login(self.sponsor)
        response = self.client.post(
            f"/operations/{operation.pk}/abandon/", {}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        operation.refresh_from_db()
        self.assertEqual(operation.status, "ABANDONED")
        replacement = self.prepare()
        submit_signed(self.sponsor, replacement, self.signed(replacement))
        response = self.client.post(
            f"/operations/{replacement.pk}/abandon/",
            {},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 409)

    def test_unknown_payment_refund_at_cutoff_does_not_release_reservation(self):
        from datetime import timedelta

        operation = self.prepare()
        submit_signed(self.sponsor, operation, self.signed(operation))
        self.rpc.state["timestamp"] = int(
            self.award.program.payout_deadline.timestamp()
        )
        ChainOperation.objects.filter(pk=operation.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1), status="UNKNOWN"
        )
        with self.assertRaises(ChainError):
            prepare_action(
                self.sponsor,
                self.award,
                "REFUND",
                {"expected_version": "3", "params": {}},
                uuid.uuid4(),
            )
        operation.refresh_from_db()
        self.assertTrue(operation.reserves_source)
        self.assertEqual(operation.status, "UNKNOWN")


from django.test import TransactionTestCase
from django.db import close_old_connections, connections
from concurrent.futures import ThreadPoolExecutor


class ChainConcurrencyTests(TransactionTestCase):
    member = fixtures.AwardPermissionTests.member
    setUp = ChainTests.setUp
    prepare = ChainTests.prepare
    signed = ChainTests.signed

    def test_two_workers_confirm_one_projection(self):
        operation = self.prepare()
        submit_signed(self.sponsor, operation, self.signed(operation))
        self.rpc.state.update(status="PAID", version=4)
        self.rpc.result = {
            "status": "SUCCESS",
            "ledger": 123,
            "return_value": None,
            "body_hash": operation.unsigned_hash,
        }

        def run():
            close_old_connections()
            try:
                return reconcile(operation).status
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(
                list(pool.map(lambda _: run(), range(2))), ["CONFIRMED_SUCCESS"] * 2
            )
        self.assertEqual(
            ChainObservation.objects.filter(status="CONFIRMED_SUCCESS").count(), 1
        )
