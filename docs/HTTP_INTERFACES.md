# Proposed HTTP interfaces

Status: Task 4 pipeline shapes remain authoritative for prepare/submit/status/abandon. **Runtime note (17 Nov 2026):** the target app is Next.js + Supabase Auth ([ADR-0001](decisions/0001-nextjs-supabase-runtime.md)). Session cookies replace Django sessions; mutating handlers require a matching `Origin` instead of Django CSRF. Chain error bodies keep `{"error":"CODE"}`. Other JSON uses `{error:{code,message,fields}}`. Live Testnet checks remain open.

## Common rules

Use authenticated sessions on every write. Reject unexpected keys and malformed types with 400. UUIDs are opaque resource IDs, never proof of access. Scope objects before returning details. Unrelated users get 404; known authorized objects with forbidden actions get 403. JSON endpoints return 401 for an expired/missing session; HTML pages redirect to login.

Decimal strings encode amount, chain version, fee, and ledger timestamp. Revision is an integer from 1 through u32 max. Evidence digests are exactly 64 hexadecimal characters. Enforce request-body limits in app and proxy; signed-XDR JSON max 256 KiB, action JSON max 16 KiB. Decode and validate XDR regardless of body size. Evidence upload has the existing limit of three files at 5 MiB each, plus bounded multipart overhead; reject excess before persisting files.

Client never supplies a destination, asset, amount, contract ID, RPC URL, arbitrary method, or fee override. Derive these from verified award terms/config. Persist operation ownership; another user's operation is never writable. Field names below are the planned HTTP names, not existing SDK arguments.

## Create a community project

`POST /api/v1/programs` accepts `title` (1 to 160 characters), `requirements_text` (1 to 4,000 characters), `verifier_member_id` (UUID), and `claim_deadline`, `review_deadline`, and `payout_deadline` (UTC ISO timestamps in strictly increasing order, with submission in the future). It returns 201 with `{ "id": "<program UUID>" }`. The server requires an active sponsor and the selected active verifier from a shared program, with distinct users and existing Stellar wallets. It creates the program and both memberships in a single transaction. Funding remains a separate award action.

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
| REPLACE_VERIFIER | `new_verifier_member_id` positive integer membership ID | Pre-provisioned same-program verifier; derive valid distinct wallet |
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

The implemented browser evidence endpoint renders field errors or redirects to the scoped award page after saving. Evidence details (UUID, revision, digest and private preview) are available there; a JSON upload response is not yet exposed. Downloads are addressed by evidence **file** id: `GET /evidence/<file uuid>/download`. There is no storage URL in a response. `/awards/<uuid>/review/` accepts the allowlisted review action, `evidence_id`, `expected_version`, `rationale` and `source_check_method`; the request-changes and dispute aliases fix their respective actions. Stale forms return HTTP 409 and a visible refresh warning. Invalid forms return 400. Saved actions remain PENDING until the Task 4 signing/confirmation pipeline exists.


## Task 4 implementation details

`POST /operations/<uuid>/abandon/` accepts `{}` for the same actor's unsigned PREPARED operation. Signed/submitted/unknown requests cannot be abandoned. The legacy `/prepare/payout/` spelling maps to PAY; all other actions use the documented fixed allowlist. Current ProgramMember primary keys are integers, so the replacement member parameter uses a positive integer ID scoped to that award's program rather than an invented UUID. Approval preparation additionally requires the saved review's affirmative `source_confirmed` checkbox. Source confirmation, rationale and source reference remain private and are not contract arguments.

Network writes default disabled (`STELLAR_ALLOW_SUBMISSION=0`). An explicitly configured installed WASM hash, matching native SAC and Testnet identity are required for real preparation. Setting a local funded snapshot is not equivalent to contract verification. Operation polling exposes only status/hash/ledger/error/time; prepared XDR is returned only to the actor by preparation. Current sponsor/verifier may inspect another actor's operation; recipients inspect only their own operations.


## Mobile app access (19 Nov 2026, [ADR-0002](decisions/0002-expo-mobile-client.md), [ADR-0003](decisions/0003-built-in-testnet-wallet.md))

Enabled only when `MOBILE_BEARER_AUTH=1`; default off.

- **Login:** `POST /api/v1/session/login` with `"client": "mobile"` uses the same throttle and account mapping. `access_token`, `refresh_token` and `expires_at` are added to the body, and no cookies are set, only when the request has no `Origin` header. A browser request that sends `Origin` keeps the cookie session and does not receive tokens. An origin-less login is accepted only in this mode; a cross-site `Origin` is always rejected.
- **Refresh:** `POST /api/v1/session/refresh` with `{ "refresh_token" }` returns rotated tokens. It is accepted only without `Origin` and `Cookie` headers (native apps), so the app ships no Supabase URL or key.
- **Bearer requests:** `Authorization: Bearer <access_token>` is honored only when the request carries **no `Cookie` header** (`bearerToken` in `web/lib/http.ts`). Such a request skips the `Origin` check, because CSRF needs ambient cookies. A request with both a cookie and a bearer token keeps the strict cookie rules.
- **Routes that accept bearer auth** (through `getRequestAuthUser`): `GET /session`, `GET /awards`, `GET /awards/<id>`, evidence `begin` (POST/DELETE) and `finalize`, `GET /evidence/<id>/download`, `POST /awards/<id>/review`, `GET /operations/<id>/status`, `GET /awards/<id>/operations/open`, and (ADR-0003, for the phone's Testnet wallet) `POST /awards/<id>/prepare/<action>`, `POST /operations/<id>/submit`, `POST /operations/<id>/abandon`. Export, admin, program creation and password change remain **cookie-only**. The server's actor, wallet, state and envelope checks are the same for both session kinds.
- `GET /api/v1/awards` returns `{ amount_base_units, awards: [...AwardListView, my_roles, deadlines: { claim, review, payout }, my_open_operation] }` from the existing visibility query; `my_open_operation` is true only when the caller owns an unfinished chain operation on that award. `GET /api/v1/session` memberships include `public_wallet`. Each award also carries `changes_requested` (a REQUEST_CHANGES note exists on the latest evidence revision), and `GET /api/v1/awards/<id>` adds `notes`: the award's change requests and disputes, newest first, `{ id, kind, note, source_check, evidence_revision, author_username, created_at }`, visible only to the award's active sponsor, verifier and recipient (`loadReviewNotesForUser`). The website shows the same notes on the award page. `GET /api/v1/awards/<id>` returns `{ award, program (terms and deadlines), amount_base_units, evidence }`. Invisible awards return 404.
