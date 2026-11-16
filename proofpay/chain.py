import hashlib
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from stellar_sdk import (
    Address,
    Asset,
    Keypair,
    Network,
    SorobanServer,
    StrKey,
    TransactionBuilder,
    TransactionEnvelope,
    scval,
    xdr,
)
from stellar_sdk.client.requests_client import RequestsClient

from proofpay.evidence import verify_evidence
from proofpay.models import (
    Award,
    ChainObservation,
    ChainOperation,
    EvidenceVersion,
    ProgramMember,
    ReviewAction,
)
from proofpay.permissions import require_award_role

NETWORK = Network.TESTNET_NETWORK_PASSPHRASE
ACTIVE = ("BUILDING", "PREPARED", "SIGNED", "SUBMITTED", "UNKNOWN")
TERMINAL = ("CONFIRMED_SUCCESS", "CONFIRMED_FAILED", "ABANDONED", "STALE")
ROLES = {
    "DEPLOY": {"SPONSOR"},
    "FUND": {"SPONSOR"},
    "CANCEL": {"SPONSOR"},
    "SUBMIT": {"RECIPIENT"},
    "APPROVE": {"VERIFIER"},
    "REJECT": {"VERIFIER"},
    "REOPEN": {"VERIFIER"},
    "SET_HOLD": {"SPONSOR", "VERIFIER"},
    "REPLACE_VERIFIER": {"SPONSOR"},
    "PAY": {"SPONSOR"},
    "REFUND": {"SPONSOR"},
    "EXTEND_TTL": {"SPONSOR", "VERIFIER", "RECIPIENT"},
}
PARAMS = {
    "SUBMIT": {"evidence_id"},
    "SET_HOLD": {"held"},
    "REPLACE_VERIFIER": {"new_verifier_member_id"},
}


class ChainError(Exception):
    def __init__(self, code, status=409):
        self.code, self.status = code, status
        super().__init__(code)


def gateway():
    return RPCGateway()


def observe(operation, status, code="", ledger=None):
    operation.status = status
    operation.error_code = code
    operation.last_checked_at = timezone.now()
    if ledger is not None:
        operation.confirmed_ledger = ledger
    operation.save()
    ChainObservation.objects.create(
        operation=operation, status=status, code=code, ledger=ledger
    )


def validate_intent(action, payload):
    if action not in ROLES or not isinstance(payload, dict):
        raise ChainError("INVALID_ACTION", 400)
    keys = (
        {"params"}
        if action in ("DEPLOY", "EXTEND_TTL")
        else {"params", "expected_version"}
    )
    if (
        set(payload) != keys
        or not isinstance(payload.get("params"), dict)
        or set(payload["params"]) != PARAMS.get(action, set())
    ):
        raise ChainError("INVALID_PARAMETERS", 400)
    if "expected_version" in payload:
        version = payload["expected_version"]
        if (
            not isinstance(version, str)
            or not version.isascii()
            or not version.isdigit()
            or int(version) > 2**64 - 1
        ):
            raise ChainError("INVALID_VERSION", 400)
    params = payload["params"]
    if action == "SET_HOLD" and type(params["held"]) is not bool:
        raise ChainError("INVALID_PARAMETERS", 400)
    if action == "REPLACE_VERIFIER" and (
        type(params["new_verifier_member_id"]) is not int
        or params["new_verifier_member_id"] <= 0
    ):
        raise ChainError("INVALID_PARAMETERS", 400)
    for key in ("evidence_id",):
        if key in params:
            try:
                uuid.UUID(params[key])
            except (ValueError, TypeError, AttributeError):
                raise ChainError("INVALID_PARAMETERS", 400) from None


def constructor_manifest(award):
    if award.deployment_manifest:
        return award.deployment_manifest
    nonce = secrets.token_hex(32)
    policy = json.dumps(
        {
            "requirements": award.program.requirements_text,
            "version": award.program.requirements_version,
            "nonce": nonce,
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    return {
        "sponsor": award.sponsor_member.public_wallet,
        "verifier": award.verifier_member.public_wallet,
        "recipient": award.recipient_member.public_wallet,
        "token": Asset.native().contract_id(NETWORK),
        "amount": 200000000,
        "award_id": secrets.token_hex(32),
        "policy_hash": hashlib.sha256(policy).hexdigest(),
        "policy_nonce": nonce,
        "requirements_text": award.program.requirements_text,
        "claim_deadline": int(award.program.claim_deadline.timestamp()),
        "review_deadline": int(award.program.review_deadline.timestamp()),
        "payout_deadline": int(award.program.payout_deadline.timestamp()),
        "salt": secrets.token_hex(32),
    }


def deployment_contract_id(manifest):
    preimage = xdr.HashIDPreimage(
        xdr.EnvelopeType.ENVELOPE_TYPE_CONTRACT_ID,
        contract_id=xdr.HashIDPreimageContractID(
            network_id=xdr.Hash(Network(NETWORK).network_id()),
            contract_id_preimage=xdr.ContractIDPreimage(
                xdr.ContractIDPreimageType.CONTRACT_ID_PREIMAGE_FROM_ADDRESS,
                from_address=xdr.ContractIDPreimageFromAddress(
                    Address(manifest["sponsor"]).to_xdr_sc_address(),
                    xdr.Uint256(bytes.fromhex(manifest["salt"])),
                ),
            ),
        ),
    )
    return StrKey.encode_contract(hashlib.sha256(preimage.to_xdr_bytes()).digest())


def expected_transition(award, action, payload, snapshot, member):
    expected = dict(snapshot)
    state = snapshot.get("status")
    now = snapshot.get("timestamp", int(timezone.now().timestamp()))
    manifest = award.deployment_manifest
    deadlines = {
        key: manifest.get(key, int(getattr(award.program, key).timestamp()))
        for key in ("claim_deadline", "review_deadline", "payout_deadline")
    }
    if action not in ("DEPLOY", "EXTEND_TTL") and snapshot.get("version") != int(
        payload["expected_version"]
    ):
        raise ChainError("STALE_VERSION")
    allowed = {
        "FUND": {"CREATED"},
        "CANCEL": {"CREATED"},
        "SUBMIT": {"FUNDED", "SUBMITTED"},
        "APPROVE": {"SUBMITTED"},
        "REJECT": {"SUBMITTED", "APPROVED"},
        "REOPEN": {"REJECTED", "APPROVED"},
        "PAY": {"APPROVED"},
        "REFUND": {"FUNDED", "SUBMITTED", "APPROVED", "REJECTED"},
        "SET_HOLD": {"FUNDED", "SUBMITTED", "APPROVED", "REJECTED"},
        "REPLACE_VERIFIER": {"CREATED", "FUNDED", "SUBMITTED", "APPROVED", "REJECTED"},
    }
    if action in allowed and state not in allowed[action]:
        raise ChainError("INVALID_STATE")
    deadline = (
        "claim_deadline"
        if action in ("FUND", "SUBMIT")
        else "review_deadline"
        if action in ("APPROVE", "REJECT", "REOPEN", "REPLACE_VERIFIER")
        else "payout_deadline"
        if action == "PAY"
        else None
    )
    if deadline and now > deadlines[deadline]:
        raise ChainError("DEADLINE")
    if action == "REFUND" and now <= deadlines["payout_deadline"]:
        raise ChainError("DEADLINE")
    if action in ("APPROVE", "PAY") and (
        snapshot.get("sponsor_hold") or snapshot.get("verifier_hold")
    ):
        raise ChainError("HELD")
    if action in ("APPROVE", "REJECT", "REOPEN"):
        evidence = award.evidence_versions.first()
        if (
            not evidence
            or evidence.revision != snapshot.get("evidence_revision")
            or evidence.digest != snapshot.get("evidence_digest")
        ):
            raise ChainError("STALE_EVIDENCE")
        verify_evidence(evidence)
    statuses = {
        "FUND": "FUNDED",
        "CANCEL": "CANCELLED",
        "SUBMIT": "SUBMITTED",
        "APPROVE": "APPROVED",
        "REJECT": "REJECTED",
        "REOPEN": "SUBMITTED",
        "PAY": "PAID",
        "REFUND": "REFUNDED",
    }
    if action in statuses:
        expected["status"] = statuses[action]
    if action not in ("DEPLOY", "EXTEND_TTL"):
        expected["version"] = snapshot["version"] + 1
    if action == "SUBMIT":
        try:
            evidence = award.evidence_versions.get(pk=payload["params"]["evidence_id"])
        except EvidenceVersion.DoesNotExist:
            raise ChainError("EVIDENCE_NOT_FOUND", 404) from None
        if (
            award.evidence_versions.first().pk != evidence.pk
            or evidence.revision != snapshot.get("evidence_revision", 0) + 1
        ):
            raise ChainError("STALE_EVIDENCE")
        verify_evidence(evidence)
        expected.update(
            evidence_revision=evidence.revision, evidence_digest=evidence.digest
        )
    if action == "SET_HOLD":
        expected["sponsor_hold" if member.role == "SPONSOR" else "verifier_hold"] = (
            payload["params"]["held"]
        )
    if action == "REPLACE_VERIFIER":
        try:
            replacement = ProgramMember.objects.get(
                pk=payload["params"]["new_verifier_member_id"],
                program=award.program,
                role="VERIFIER",
                active=True,
            )
        except (ProgramMember.DoesNotExist, ValueError):
            raise ChainError("INVALID_VERIFIER", 400) from None
        if replacement.public_wallet in {
            award.sponsor_member.public_wallet,
            award.recipient_member.public_wallet,
            snapshot.get("verifier"),
        }:
            raise ChainError("INVALID_VERIFIER", 400)
        expected.update(verifier=replacement.public_wallet, verifier_hold=False)
        if state in ("APPROVED", "REJECTED"):
            expected["status"] = "SUBMITTED"
    return {
        key: expected.get(key)
        for key in (
            "status",
            "version",
            "evidence_revision",
            "evidence_digest",
            "verifier",
            "sponsor_hold",
            "verifier_hold",
        )
    }


def prepare_action(user, award, action, payload, idempotency_key):
    validate_intent(action, payload)
    try:
        key = uuid.UUID(str(idempotency_key))
    except ValueError:
        raise ChainError("INVALID_IDEMPOTENCY_KEY", 400) from None
    intent = {"award": str(award.pk), "action": action, "payload": payload}
    # Read before locking; only ledger time can release an expired payout reservation.
    refund_snapshot = gateway().read_award(award) if action == "REFUND" else None
    previous = ChainOperation.objects.filter(actor=user, idempotency_key=key).first()
    if previous and previous.intent == intent and previous.status == "PREPARED":
        fresh = gateway().read_award(award) if action != "DEPLOY" else {}
        member = require_award_role(user, award, ROLES[action])
        if action != "DEPLOY":
            expected_transition(award, action, payload, fresh, member)
    with transaction.atomic():
        get_user_model().objects.select_for_update().get(pk=user.pk)
        award = Award.objects.select_for_update().get(pk=award.pk)
        member = require_award_role(user, award, ROLES[action])
        existing = ChainOperation.objects.filter(
            actor=user, idempotency_key=key
        ).first()
        if existing:
            if existing.intent != intent:
                raise ChainError("IDEMPOTENCY_CONFLICT")
            if existing.status != "PREPARED" or existing.expires_at <= timezone.now():
                raise ChainError("OPERATION_" + existing.status)
            return existing
        expired = list(
            ChainOperation.objects.filter(
                signer=member.public_wallet,
                status__in=("BUILDING", "PREPARED"),
                expires_at__lte=timezone.now(),
            ).select_for_update()
        )
        for old in expired:
            observe(old, "ABANDONED", "UNSIGNED_EXPIRED")
        if refund_snapshot:
            cutoff = award.deployment_manifest.get(
                "payout_deadline", int(award.program.payout_deadline.timestamp())
            )
            ledger_time = refund_snapshot.get("timestamp", 0)
            if ledger_time > cutoff and refund_snapshot.get("status") in (
                "FUNDED",
                "SUBMITTED",
                "APPROVED",
                "REJECTED",
            ):
                for old in ChainOperation.objects.select_for_update().filter(
                    award=award,
                    signer=member.public_wallet,
                    action="PAY",
                    signed_hash__isnull=False,
                    status__in=("SIGNED", "SUBMITTED", "UNKNOWN"),
                    reserves_source=True,
                ):
                    if ledger_time > int(old.expires_at.timestamp()):
                        old.reserves_source = False
                        observe(old, "UNKNOWN", "EXPIRED_ENVELOPE_REFUND_ELIGIBLE")
        if ChainOperation.objects.filter(
            signer=member.public_wallet, status__in=ACTIVE, reserves_source=True
        ).exists():
            raise ChainError("UNRESOLVED_OPERATION")
        if action == "DEPLOY":
            if award.contract_id:
                raise ChainError("ALREADY_DEPLOYED")
            award.deployment_manifest = constructor_manifest(award)
            award.save(update_fields=("deployment_manifest",))
        try:
            with transaction.atomic():
                operation = ChainOperation.objects.create(
                    award=award,
                    actor=user,
                    signer=member.public_wallet,
                    action=action,
                    idempotency_key=key,
                    intent=intent,
                    expires_at=timezone.now() + timedelta(seconds=120),
                )
        except IntegrityError:
            raise ChainError("UNRESOLVED_OPERATION") from None
    try:
        rpc = gateway()
        snapshot = rpc.read_award(award) if action != "DEPLOY" else {}
        if (
            action != "DEPLOY"
            and snapshot.get("verifier") != award.verifier_member.public_wallet
        ):
            raise ChainError("VERIFIER_RECONCILIATION_REQUIRED")
        expected = (
            expected_transition(award, action, payload, snapshot, member)
            if action != "DEPLOY"
            else {
                "status": "CREATED",
                "version": 0,
                "evidence_revision": 0,
                "evidence_digest": None,
                "verifier": award.verifier_member.public_wallet,
                "sponsor_hold": False,
                "verifier_hold": False,
            }
        )
        if action in ("APPROVE", "REJECT", "REOPEN"):
            with transaction.atomic():
                review = (
                    ReviewAction.objects.select_for_update(of=("self",))
                    .filter(
                        award=award,
                        verifier=user,
                        action=action,
                        status="PENDING",
                        expected_version=snapshot["version"],
                        evidence__revision=snapshot["evidence_revision"],
                        evidence__digest=snapshot["evidence_digest"],
                        chainoperation__isnull=True,
                    )
                    .first()
                )
                if (
                    not review
                    or not review.source_check_method
                    or (action == "APPROVE" and not review.source_confirmed)
                ):
                    raise ChainError("REVIEW_REQUIRED")
                operation.review = review
                operation.save(update_fields=("review",))
        envelope = rpc.prepare(operation, snapshot)
        if (
            envelope.signatures
            or envelope.transaction.source.account_id != operation.signer
            or len(envelope.transaction.operations) != 1
        ):
            raise ChainError("INVALID_PREPARATION")
        max_fee = min(int(getattr(settings, "STELLAR_MAX_FEE", 10_000_000)), 10_000_000)
        if envelope.transaction.fee > max_fee or envelope.transaction.fee <= 0:
            raise ChainError("FEE_CEILING")
        with transaction.atomic():
            operation = ChainOperation.objects.select_for_update().get(pk=operation.pk)
            if operation.status != "BUILDING":
                raise ChainError("STALE_OPERATION")
            operation.expected_snapshot = expected
            operation.unsigned_xdr = envelope.to_xdr()
            operation.unsigned_hash = envelope.hash_hex()
            operation.expires_at = datetime.fromtimestamp(
                envelope.transaction.preconditions.time_bounds.max_time, UTC
            )
            operation.preview = {
                "transfer_from": operation.signer
                if action == "FUND"
                else award.contract_id
                if action in ("PAY", "REFUND")
                else "No stipend transfer",
                "transfer_to": award.contract_id
                if action == "FUND"
                else award.recipient_member.public_wallet
                if action == "PAY"
                else award.sponsor_member.public_wallet
                if action == "REFUND"
                else "No stipend transfer",
                "action": action,
                "network": "TESTNET",
                "network_passphrase": NETWORK,
                "signer": operation.signer,
                "recipient": award.recipient_member.public_wallet,
                "asset": "Testnet XLM",
                "amount_base_units": str(award.base_units),
                "maximum_fee_base_units": str(envelope.transaction.fee),
                "expected_version": payload.get("expected_version"),
                "evidence_revision": expected.get("evidence_revision"),
                "expires_at": operation.expires_at.isoformat(),
                "claim_deadline": award.program.claim_deadline.isoformat(),
                "review_deadline": award.program.review_deadline.isoformat(),
                "payout_deadline": award.program.payout_deadline.isoformat(),
            }
            for name in ("claim_deadline", "review_deadline", "payout_deadline"):
                if name in award.deployment_manifest:
                    operation.preview[name] = datetime.fromtimestamp(
                        award.deployment_manifest[name], UTC
                    ).isoformat()
            observe(operation, "PREPARED")
        return operation
    except Exception as error:
        with transaction.atomic():
            operation = ChainOperation.objects.select_for_update().get(pk=operation.pk)
            if operation.status == "BUILDING":
                observe(
                    operation,
                    "ABANDONED",
                    error.code if isinstance(error, ChainError) else "RPC_UNAVAILABLE",
                )
        if isinstance(error, ChainError):
            raise
        raise ChainError("RPC_UNAVAILABLE", 503) from None


def validate_signed(operation, signed_xdr):
    try:
        if not isinstance(signed_xdr, str) or len(signed_xdr) > 256 * 1024:
            raise ValueError
        prepared = TransactionEnvelope.from_xdr(operation.unsigned_xdr, NETWORK)
        signed = TransactionEnvelope.from_xdr(signed_xdr, NETWORK)
        if (
            signed.transaction.to_xdr_object().to_xdr_bytes()
            != prepared.transaction.to_xdr_object().to_xdr_bytes()
            or len(signed.signatures) != 1
        ):
            raise ValueError
        key = Keypair.from_public_key(operation.signer)
        if signed.signatures[0].signature_hint != key.signature_hint():
            raise ValueError
        key.verify(signed.hash(), signed.signatures[0].signature)
        return signed
    except Exception:  # noqa: BLE001 - malformed XDR must fail closed at this boundary.
        raise ChainError("INVALID_SIGNED_TRANSACTION", 400) from None


def submit_signed(user, operation, signed_xdr):
    signed = validate_signed(operation, signed_xdr)
    with transaction.atomic():
        operation = (
            ChainOperation.objects.select_for_update()
            .select_related("award")
            .get(pk=operation.pk)
        )
        if operation.actor_id != user.pk:
            raise ChainError("ACTION_DENIED", 403)
        require_award_role(user, operation.award, ROLES[operation.action])
        if operation.signed_hash:
            if (
                operation.signed_hash != signed.hash_hex()
                or operation.signed_xdr != signed.to_xdr()
            ):
                raise ChainError("SIGNED_INTENT_CONFLICT")
            return operation
        if operation.status != "PREPARED" or operation.expires_at <= timezone.now():
            raise ChainError("STALE_OPERATION")
        if not getattr(settings, "STELLAR_ALLOW_SUBMISSION", False):
            raise ChainError("NETWORK_SUBMISSION_DISABLED", 403)
        operation.signed_hash = signed.hash_hex()
        operation.signed_xdr = signed.to_xdr()
        observe(operation, "SIGNED")
    try:
        status = gateway().submit(operation)
        target = "SUBMITTED" if status in ("PENDING", "DUPLICATE") else "UNKNOWN"
    except Exception:  # noqa: BLE001 - a send exception does not prove transaction failure.
        target = "UNKNOWN"
    with transaction.atomic():
        operation = ChainOperation.objects.select_for_update().get(pk=operation.pk)
        if operation.status == "SIGNED":
            observe(
                operation,
                target,
                "" if target == "SUBMITTED" else "SUBMISSION_UNCONFIRMED",
            )
    return operation


def reconcile(operation):
    operation = ChainOperation.objects.select_related("award").get(pk=operation.pk)
    if operation.status in TERMINAL or not operation.signed_hash:
        return operation
    try:
        rpc = gateway()
        result = rpc.transaction(operation)
        status = result["status"]
        if status in ("SUCCESS", "FAILED") and (
            not isinstance(result.get("ledger"), int) or result["ledger"] <= 0
        ):
            raise ChainError("RESULT_MISMATCH")
        if (
            status in ("SUCCESS", "FAILED")
            and result.get("body_hash") != operation.signed_hash
        ):
            raise ChainError("RESULT_MISMATCH")
        snapshot = None
        if status == "SUCCESS":
            if operation.action == "DEPLOY":
                contract_id = result.get("return_value")
                if not isinstance(
                    contract_id, str
                ) or contract_id != deployment_contract_id(
                    operation.award.deployment_manifest
                ):
                    raise ChainError("RESULT_MISMATCH")
                operation.award.contract_id = contract_id
                operation.award.network_id = NETWORK
                operation.award.token_id = Asset.native().contract_id(NETWORK)
                operation.award.code_hash = getattr(settings, "STELLAR_WASM_HASH", "")
            elif result.get("return_value") is not None:
                raise ChainError("RESULT_MISMATCH")
            snapshot = rpc.read_award(operation.award)
            if snapshot.get("ledger", 0) < result["ledger"]:
                raise ChainError("STALE_SNAPSHOT")
            if any(
                snapshot.get(key) != value
                for key, value in operation.expected_snapshot.items()
            ):
                raise ChainError("POST_STATE_MISMATCH")
        target = (
            "CONFIRMED_SUCCESS"
            if status == "SUCCESS"
            else "CONFIRMED_FAILED"
            if status == "FAILED"
            else "UNKNOWN"
        )
        code = "" if target.startswith("CONFIRMED") else "OUTCOME_UNKNOWN"
    except Exception as error:  # noqa: BLE001 - preserve ambiguity when RPC decoding or reads fail.
        target = "UNKNOWN"
        code = error.code if isinstance(error, ChainError) else "RPC_UNAVAILABLE"
        result = {}
        snapshot = None
    with transaction.atomic():
        current = ChainOperation.objects.select_for_update().get(pk=operation.pk)
        if current.status in TERMINAL:
            return current
        if target == "CONFIRMED_SUCCESS":
            award = Award.objects.select_for_update().get(pk=current.award_id)
            if award.version > snapshot["version"]:
                target, code = "UNKNOWN", "SNAPSHOT_REGRESSION"
            else:
                if current.action == "DEPLOY":
                    award.contract_id = operation.award.contract_id
                    award.network_id = NETWORK
                    award.token_id = Asset.native().contract_id(NETWORK)
                    award.code_hash = getattr(settings, "STELLAR_WASM_HASH", "")
                for field in (
                    "status",
                    "version",
                    "evidence_revision",
                    "sponsor_hold",
                    "verifier_hold",
                ):
                    setattr(award, field, snapshot[field])
                award.evidence_digest = snapshot.get("evidence_digest") or ""
                if current.action == "REPLACE_VERIFIER":
                    replacement = ProgramMember.objects.get(
                        pk=current.intent["payload"]["params"][
                            "new_verifier_member_id"
                        ],
                        program=award.program,
                        role="VERIFIER",
                    )
                    if replacement.public_wallet != snapshot["verifier"]:
                        raise ChainError("RESULT_MISMATCH")
                    award.verifier_member = replacement
                award.deployment_error=""
                award.verifier_sync_required=False
                if snapshot["status"] in ("PAID","REFUNDED") and not award.settled_at:
                    award.settled_at=timezone.now()
                award.last_confirmed_ledger = result["ledger"]
                award.save()
        if current.review_id and target.startswith("CONFIRMED"):
            ReviewAction.objects.filter(pk=current.review_id).update(
                status="CONFIRMED" if target == "CONFIRMED_SUCCESS" else "FAILED"
            )
        observe(
            current,
            target,
            code,
            result.get("ledger") if target.startswith("CONFIRMED") else None,
        )
        return current


class RPCGateway:
    def __init__(self):
        self.server = SorobanServer(
            getattr(settings, "STELLAR_RPC_URL", "https://soroban-testnet.stellar.org"),
            client=RequestsClient(num_retries=0, request_timeout=10, post_timeout=10),
        )

    def verify_network(self):
        if (
            getattr(settings, "STELLAR_NETWORK_PASSPHRASE", NETWORK) != NETWORK
            or self.server.get_network().passphrase != NETWORK
        ):
            raise ChainError("WRONG_NETWORK")
        token = Asset.native().contract_id(NETWORK)
        entry = self.server.get_contract_data(
            token, xdr.SCVal(xdr.SCValType.SCV_LEDGER_KEY_CONTRACT_INSTANCE)
        )
        if not entry:
            raise ChainError("TOKEN_UNAVAILABLE")
        data = xdr.LedgerEntryData.from_xdr(entry.xdr)
        if (
            data.contract_data.val.instance.executable.type
            != xdr.ContractExecutableType.CONTRACT_EXECUTABLE_STELLAR_ASSET
        ):
            raise ChainError("WRONG_TOKEN")
        return token

    def verify_code(self, award):
        expected = getattr(settings, "STELLAR_WASM_HASH", "")
        if len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected):
            raise ChainError("CODE_HASH_NOT_CONFIGURED")
        if award.code_hash and award.code_hash != expected:
            raise ChainError("WRONG_CODE_HASH")
        if award.contract_id:
            entry = self.server.get_contract_data(
                award.contract_id,
                xdr.SCVal(xdr.SCValType.SCV_LEDGER_KEY_CONTRACT_INSTANCE),
            )
            if not entry:
                raise ChainError("DEPLOYMENT_UNAVAILABLE")
            executable = xdr.LedgerEntryData.from_xdr(
                entry.xdr
            ).contract_data.val.instance.executable
            if (
                executable.type != xdr.ContractExecutableType.CONTRACT_EXECUTABLE_WASM
                or executable.wasm_hash.hash.hex() != expected
            ):
                raise ChainError("WRONG_CODE_HASH")
        else:
            key = xdr.LedgerKey(
                xdr.LedgerEntryType.CONTRACT_CODE,
                contract_code=xdr.LedgerKeyContractCode(
                    xdr.Hash(bytes.fromhex(expected))
                ),
            )
            entries = self.server.get_ledger_entries([key]).entries
            if (
                not entries
                or hashlib.sha256(
                    xdr.LedgerEntryData.from_xdr(entries[0].xdr).contract_code.code
                ).hexdigest()
                != expected
            ):
                raise ChainError("CODE_NOT_INSTALLED")
        return expected

    def read_award(self, award):
        token = self.verify_network()
        if (
            award.network_id != NETWORK
            or award.token_id != token
            or not award.deployment_manifest
        ):
            raise ChainError("UNVERIFIED_AWARD")
        self.verify_code(award)
        tx = (
            TransactionBuilder(
                self.server.load_account(award.sponsor_member.public_wallet),
                NETWORK,
                base_fee=100,
            )
            .append_invoke_contract_function_op(award.contract_id, "get_state")
            .set_timeout(120)
            .build()
        )
        result = self.server.simulate_transaction(tx)
        if result.error or not result.results:
            raise ChainError("STATE_UNAVAILABLE")
        raw = scval.to_native(xdr.SCVal.from_xdr(result.results[0].xdr))
        state = {str(key): value for key, value in raw.items()}
        manifest = award.deployment_manifest
        if (
            manifest.get("token") != token
            or manifest.get("sponsor") != award.sponsor_member.public_wallet
            or manifest.get("recipient") != award.recipient_member.public_wallet
        ):
            raise ChainError("TERMS_MISMATCH")
        for key in ("sponsor", "recipient", "token"):
            if state[key].address != manifest[key]:
                raise ChainError("TERMS_MISMATCH")
        if (
            state["amount"] != 200000000
            or state["award_id"].hex() != manifest["award_id"]
            or state["policy_hash"].hex() != manifest["policy_hash"]
            or any(
                state[k] != manifest[k]
                for k in ("claim_deadline", "review_deadline", "payout_deadline")
            )
        ):
            raise ChainError("TERMS_MISMATCH")
        latest = self.server.get_latest_ledger()
        return {
            "status": state["status"][0].upper(),
            "version": state["version"],
            "evidence_revision": state["evidence_revision"],
            "evidence_digest": state["evidence_digest"].hex()
            if state["evidence_digest"] is not None
            else None,
            "verifier": state["verifier"].address,
            "sponsor_hold": state["sponsor_hold"],
            "verifier_hold": state["verifier_hold"],
            "timestamp": int(latest.close_time),
            "ledger": result.latest_ledger,
        }

    def prepare(self, operation, snapshot):
        award = operation.award
        token = self.verify_network()
        code = self.verify_code(award)
        if award.token_id and award.token_id != token:
            raise ChainError("WRONG_TOKEN")
        if award.network_id and award.network_id != NETWORK:
            raise ChainError("WRONG_NETWORK")
        builder = TransactionBuilder(
            self.server.load_account(operation.signer), NETWORK, base_fee=100
        ).set_timeout(120)
        payload = operation.intent["payload"]
        action = operation.action
        if action == "DEPLOY":
            m = award.deployment_manifest
            if m["token"] != token:
                raise ChainError("WRONG_TOKEN")
            now = int(self.server.get_latest_ledger().close_time)
            if (
                not now
                < m["claim_deadline"]
                < m["review_deadline"]
                < m["payout_deadline"]
            ):
                raise ChainError("DEADLINE")
            args = (
                [
                    scval.to_address(m[k])
                    for k in ("sponsor", "verifier", "recipient", "token")
                ]
                + [
                    scval.to_int128(m["amount"]),
                    scval.to_bytes(bytes.fromhex(m["award_id"])),
                    scval.to_bytes(bytes.fromhex(m["policy_hash"])),
                ]
                + [
                    scval.to_uint64(m[k])
                    for k in ("claim_deadline", "review_deadline", "payout_deadline")
                ]
            )
            builder.append_create_contract_op(
                code,
                operation.signer,
                constructor_args=args,
                salt=bytes.fromhex(m["salt"]),
            )
        else:
            args = []
            if action == "SUBMIT":
                evidence = award.evidence_versions.get(
                    pk=payload["params"]["evidence_id"]
                )
                args = [
                    scval.to_uint32(evidence.revision),
                    scval.to_bytes(bytes.fromhex(evidence.digest)),
                ]
            if action == "SET_HOLD":
                args = [
                    scval.to_address(operation.signer),
                    scval.to_bool(payload["params"]["held"]),
                ]
            if action == "REPLACE_VERIFIER":
                args = [
                    scval.to_address(
                        ProgramMember.objects.get(
                            pk=payload["params"]["new_verifier_member_id"]
                        ).public_wallet
                    )
                ]
            if action != "EXTEND_TTL":
                args.append(scval.to_uint64(int(payload["expected_version"])))
            builder.append_invoke_contract_function_op(
                award.contract_id,
                "extend_lifetime" if action == "EXTEND_TTL" else action.lower(),
                args,
            )
        envelope = self.server.prepare_transaction(builder.build())
        for auth in envelope.transaction.operations[0].auth:
            if (
                auth.credentials.type
                != xdr.SorobanCredentialsType.SOROBAN_CREDENTIALS_SOURCE_ACCOUNT
            ):
                raise ChainError("UNSUPPORTED_AUTH")
        return envelope

    def submit(self, operation):
        self.verify_network()
        return self.server.send_transaction(
            TransactionEnvelope.from_xdr(operation.signed_xdr, NETWORK)
        ).status.value

    def transaction(self, operation):
        self.verify_network()
        result = self.server.get_transaction(operation.signed_hash)
        status = result.status.value
        if status not in ("SUCCESS", "FAILED"):
            return {"status": status}
        envelope = TransactionEnvelope.from_xdr(result.envelope_xdr, NETWORK)
        decoded = xdr.TransactionResult.from_xdr(result.result_xdr)
        if (status == "SUCCESS") != (
            decoded.result.code == xdr.TransactionResultCode.txSUCCESS
        ):
            raise ChainError("RESULT_MISMATCH")
        outcome = {
            "status": status,
            "ledger": result.ledger,
            "body_hash": envelope.hash_hex(),
        }
        if status == "SUCCESS":
            meta = xdr.TransactionMeta.from_xdr(result.result_meta_xdr)
            body = meta.v4 or meta.v3
            if not body or not body.soroban_meta:
                raise ChainError("RESULT_MISMATCH")
            value = scval.to_native(body.soroban_meta.return_value)
            outcome["return_value"] = (
                value.address if isinstance(value, Address) else value
            )
        return outcome


def read_award(contract_id):
    return gateway().read_award(Award.objects.get(contract_id=contract_id))
