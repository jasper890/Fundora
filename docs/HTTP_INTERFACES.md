# Proposed HTTP interfaces

Status: implementation contract for the routes already listed in [system plan §5](../ProofPay_System_and_Implementation_Plan.md). None is implemented. The system plan governs roles, states, and fund rules. These JSON shapes make its pipeline concrete; they add no new payment feature.

## Common rules

Use authenticated Django sessions and CSRF protection on every write. Browser forms use normal CSRF tokens; JSON writes use `X-CSRFToken`. Reject unexpected keys and malformed types with 400. UUIDs are opaque resource IDs, never proof of access. Scope objects before returning details. Unrelated users get 404; known authorized objects with forbidden actions get 403. JSON endpoints return 401 for an expired/missing session; HTML pages redirect to login.

Decimal strings encode amount, chain version, fee, and ledger timestamp. Revision is an integer from 1 through u32 max. Evidence digests are exactly 64 hexadecimal characters. Enforce request-body limits in app and proxy; signed-XDR JSON max 256 KiB, action JSON max 16 KiB. Decode and validate XDR regardless of body size. Evidence upload has the existing limit of three files at 5 MiB each, plus bounded multipart overhead; reject excess before persisting files.

Client never supplies a destination, asset, amount, contract ID, RPC URL, arbitrary method, or fee override. Derive these from verified award terms/config. Persist operation ownership; another user's operation is never writable. Field names below are the planned HTTP names, not existing SDK arguments.

## Prepare an action

`POST /awards/<uuid>/prepare/<action>/`, with `Idempotency-Key` header (UUID generated once per intended action). Canonicalize the action name to the plan's uppercase enum through a fixed route lookup; no dynamic contract-method dispatch.

Example `SUBMIT` request:

```json
{
  "expected_version": "2",
  "params": {"evidence_id": "44444444-4444-4444-8444-444444444444"}
}
```

The server loads the immutable evidence row, derives revision/digest, verifies actor ownership and current revision, then invokes the proposed contract `submit`. User-provided hashes cannot replace the stored manifest.

| Action | Accepted `params` | Additional rule |
|---|---|---|
| DEPLOY | `{}` | `expected_version` omitted; save deployment salt and frozen constructor terms before signing |
| FUND, CANCEL, APPROVE, REJECT, REOPEN, PAY, REFUND | `{}` | `expected_version` required; reject stale state |
| SUBMIT | `evidence_id` UUID | Resolve exact stored revision/digest |
| SET_HOLD | `held` boolean | Derive actor address from logged-in member |
| REPLACE_VERIFIER | `new_verifier_member_id` UUID | Pre-provisioned same-program verifier; derive valid distinct wallet |
| EXTEND_TTL | `{}` | App permits scoped members; contract itself allows anyone to pay TTL fees; no business-version argument |

Rejection/review rationale and source checks are stored as a pending `ReviewAction` before preparing the chain decision; they never become on-chain text. Preparation must find an authorized pending decision for the current evidence revision and bind it to the operation. Approval requires recorded source-check method and affirmative confirmation. A persisted request is not a confirmed approval.

Return 201 for a newly prepared operation and 200 for a matching repeat key:

```json
{
  "operation_id": "55555555-5555-4555-8555-555555555555",
  "status": "PREPARED",
  "unsigned_xdr": "<server-prepared base64 XDR>",
  "preview": {
    "action": "SUBMIT",
    "network": "TESTNET",
    "network_passphrase": "<configured Testnet passphrase>",
    "signer": "<assigned G-address>",
    "recipient": "<immutable recipient G-address>",
    "asset": "Testnet XLM",
    "amount_base_units": "200000000",
    "maximum_fee_base_units": "<computed decimal string>",
    "expected_version": "2",
    "evidence_revision": 1,
    "expires_at": "<UTC RFC3339 timestamp>"
  }
}
```

Angle-bracket values are documentation placeholders, never seed addresses or valid XDR. Preview amount describes award terms; for SUBMIT it does not imply a transfer. For PAY/FUND/REFUND explicitly display transfer direction. Same key plus different intent gives 409 `IDEMPOTENCY_CONFLICT`. Never return an expired/stale signing request as freshly usable; return 409 with current operation status. Concurrent pending operations for the same source account require serialization or rejection while sequence use is unresolved; do not hand out conflicting sequence numbers.

## Sign, submit, and poll

`POST /operations/<uuid>/submit/` accepts only `{"signed_xdr":"<base64 signed envelope>"}`. Body, network, source, expected signatures and allowlisted operations MUST match the stored request. Reject fee-bump or alternate envelope structures unless explicitly supported and checked; v1 expects the prepared envelope type.

Persist signed bytes/hash before network submission. Return 202 with operation ID/status for submitted or unknown outcomes, 200 for a repeat already confirmed. Matching repeats return the same operation; a different signed transaction for it gives 409. A decline before submission is an app cancellation, never a failed payment.

`GET /operations/<uuid>/` returns ID, action, status, nullable transaction hash, nullable confirmed ledger, nullable safe error code, and last-checked time. Actor and assigned current program reviewers may read; no signed/unsigned XDR or private evidence is returned here. Do not treat polling's HTTP 200 as payment success. UI follows documented statuses; only CONFIRMED_SUCCESS plus reconciled expected post-state means success.

## Evidence, reviews, and exports

`POST /awards/<uuid>/evidence/` accepts multipart `files`, `explanation` (max 2,000 characters), and `source_ref` (max 512 characters). Validate permitted PDF/JPEG/PNG content signatures and filenames, create an immutable revision with random nonce, then return evidence UUID/revision/digest and preview summary. Server derives author/award. Failed uploads leave no orphan files. Uploaded evidence remains a draft until its signed submission confirms.

`GET /evidence/<uuid>/download/` returns an authenticated attachment with `nosniff`, private/no-store caching, and no public redirect. Resolve confirmed role access at request time. The database-only administrator role has no automatic evidence download capability through application pages.

Reviewer `POST /awards/<uuid>/request-changes/` records current evidence ID, bounded rationale (2,000 chars), and source-check method (512 chars). An APPROVE/REJECT/REOPEN form on the authorized award/review page records a pending review intent using those same fields before calling prepare; the implementer must wire that form without inventing an on-chain text parameter. Recipient `POST /awards/<uuid>/disputes/` records a private rationale; it does not set a contract hold. These actions never imply chain settlement.

`GET /programs/<uuid>/export/?format=json|csv` is sponsor/current-verifier only. Escape spreadsheet-formula prefixes in text, exclude secrets/evidence URLs, and use attachment + private/no-store headers. Never offer cross-program exports.

## Error vocabulary

| HTTP | Code examples | User experience |
|---|---|---|
| 400 / 413 | INVALID_PAYLOAD / UPLOAD_TOO_LARGE | Field errors; preserve safe entered values |
| 401 / 403 / 404 | AUTH_REQUIRED / ACTION_DENIED / NOT_FOUND | Login or safe access explanation |
| 409 | STALE_VERSION, INVALID_STATE, IDEMPOTENCY_CONFLICT, OPERATION_UNRESOLVED | Refresh current state; never auto-pay |
| 422 | WRONG_NETWORK, INVALID_SIGNATURE, TRANSACTION_MISMATCH, FEE_LIMIT | Explain why signing/submission was rejected |
| 429 | RATE_LIMITED | Bounded retry guidance |
| 503 | RPC_UNAVAILABLE | Operation status retained; retry status lookup |

JSON errors use `{"error":{"code":"STALE_VERSION","message":"Award changed. Refresh before signing.","fields":{}}}`. Unexpected failures return a safe generic message and correlation ID, with redacted diagnostics. A network failure after submit is UNKNOWN, not an invitation to prepare a replacement payment. Test payload, role, idempotency, sequence contention, and ambiguity cases in Task 4.


## Task 3 implementation note

The implemented browser evidence endpoint renders field errors or redirects to the scoped award page after saving. Evidence details (UUID, revision, digest and private preview) are available there; a JSON upload response is not yet exposed. Multi-file downloads use `?file=0`, `?file=1` or `?file=2` (default zero), bounded to that version's ordered files. There is no storage URL in a response. `/awards/<uuid>/review/` accepts the allowlisted review action, `evidence_id`, `expected_version`, `rationale` and `source_check_method`; the request-changes and dispute aliases fix their respective actions. Stale forms return HTTP 409 and a visible refresh warning. Invalid forms return 400. Saved actions remain PENDING until the Task 4 signing/confirmation pipeline exists.
