import json
import uuid
from functools import wraps

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from proofpay.chain import (
    ROLES,
    ChainError,
    observe,
    prepare_action,
    reconcile,
    submit_signed,
)
from proofpay.models import ChainOperation
from proofpay.permissions import require_award_role, visible_awards


def api(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "AUTH_REQUIRED"}, status=401)
        try:
            return view(request, *args, **kwargs)
        except ChainError as error:
            return JsonResponse({"error": error.code}, status=error.status)
        except PermissionDenied:
            return JsonResponse({"error": "ACTION_DENIED"}, status=403)

    return never_cache(wrapped)


def body(request, limit, keys):
    try:
        length = int(request.META.get("CONTENT_LENGTH") or 0)
    except (ValueError, TypeError):
        raise ChainError("INVALID_BODY", 400) from None
    if request.content_type != "application/json" or length > limit:
        raise ChainError("INVALID_BODY", 400)
    if len(request.body) > limit:
        raise ChainError("INVALID_BODY", 400)
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        raise ChainError("INVALID_BODY", 400) from None
    if not isinstance(data, dict) or (keys is not None and set(data) != keys):
        raise ChainError("INVALID_PARAMETERS", 400)
    return data


def public_operation(operation):
    return {
        "operation_id": str(operation.pk),
        "action": operation.action,
        "status": operation.status,
        "transaction_hash": operation.signed_hash,
        "confirmed_ledger": str(operation.confirmed_ledger)
        if operation.confirmed_ledger
        else None,
        "error_code": operation.error_code or None,
        "last_checked_at": operation.last_checked_at.isoformat()
        if operation.last_checked_at
        else None,
    }


@require_POST
@api
def prepare(request, award_id, action):
    award = get_object_or_404(visible_awards(request.user), pk=award_id)
    action = action.upper()
    if action == "PAYOUT":
        action = "PAY"
    if action not in ROLES:
        raise ChainError("INVALID_ACTION", 400)
    require_award_role(request.user, award, ROLES[action])
    data = body(request, 16 * 1024, None)
    key = request.headers.get("Idempotency-Key", "")
    try:
        uuid.UUID(key)
    except (ValueError, TypeError):
        raise ChainError("INVALID_IDEMPOTENCY_KEY", 400) from None
    existed = ChainOperation.objects.filter(
        actor=request.user, idempotency_key=key
    ).exists()
    operation = prepare_action(request.user, award, action, data, key)
    return JsonResponse(
        {
            **public_operation(operation),
            "unsigned_xdr": operation.unsigned_xdr,
            "preview": operation.preview,
        },
        status=200 if existed else 201,
    )


@require_POST
@api
def submit(request, operation_id):
    operation = get_object_or_404(ChainOperation, pk=operation_id, actor=request.user)
    data = body(request, 256 * 1024, {"signed_xdr"})
    operation = submit_signed(request.user, operation, data["signed_xdr"])
    return JsonResponse(
        public_operation(operation),
        status=200 if operation.status.startswith("CONFIRMED") else 202,
    )


@require_GET
@api
def status(request, operation_id):
    operation = get_object_or_404(
        ChainOperation.objects.filter(award__in=visible_awards(request.user)),
        pk=operation_id,
    )
    if operation.actor_id != request.user.pk:
        require_award_role(request.user, operation.award, {"SPONSOR", "VERIFIER"})
    return JsonResponse(public_operation(reconcile(operation)))


@require_POST
@api
def abandon(request, operation_id):
    body(request, 1024, set())
    with transaction.atomic():
        operation = get_object_or_404(
            ChainOperation.objects.select_for_update(),
            pk=operation_id,
            actor=request.user,
        )
        if operation.status != "PREPARED" or operation.signed_hash:
            raise ChainError("UNRESOLVED_OPERATION")
        observe(operation, "ABANDONED", "WALLET_DECLINED")
    return JsonResponse(public_operation(operation))
