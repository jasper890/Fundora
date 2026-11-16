# Local setup and recovery procedures

Status: Task 1 local setup is being implemented and verified. The current baseline has no Soroban contract, evidence upload/download flow, chain transaction workflow, or deployed service. The [system plan](../ProofPay_System_and_Implementation_Plan.md) remains the source for product and chain behavior.

## Verified local setup

The implementation worktree is `C:\Users\R O G - S T R I X\.codex\worktrees\b84f\Proofpay` on Windows PowerShell. The recorded tools are Python 3.13.15, uv 0.12.21, Django 5.2.19, stellar-sdk 17.0.1, psycopg 3.3.9, Node 24.19.0, npm 11.17.0, TypeScript 7.0.2, esbuild 0.28.2, Rust/Cargo 1.99.1, Stellar CLI 28.1.0, Docker 29.8.1, and PostgreSQL 17 from the pinned major-version image. Rust target `wasm32v1-none` is installed. Recheck versions if the lockfiles or toolchain change.

From the repository root:

```powershell
uv sync --locked
docker compose up -d db
uv run python manage.py migrate --noinput
npm.cmd ci
npm.cmd run build
uv run python manage.py test proofpay.tests.test_permissions
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
```

The local database runs in a dedicated `proofpay-postgres` container, uses the named `proofpay-postgres` volume, and is published only to `127.0.0.1:55432`. Its trust authentication is a local development shortcut. Do not expose it beyond loopback or reuse it for a hosted environment; configure a database password and secure transport there. Other Docker projects are separate and are not modified by this compose file.

The Django development secret fallback is enabled only while `DEBUG` is true. With `DEBUG` disabled, set `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD`; configure `DJANGO_ALLOWED_HOSTS`, PostgreSQL connection values, secure storage and HTTPS before any hosted deployment. `PRIVATE_EVIDENCE_ROOT` defaults to a directory outside Django's static URL handling. There is no public media route. No personal evidence or real wallet material belongs in this worktree.

`runserver` is for loopback-only local development, for example `uv run python manage.py runserver 127.0.0.1:8000`. It is not a staging or production server. Public signup is not configured; accounts are provisioned by an operator. Do not commit generated credentials.

## Open Task 1 gates

- The Python and browser dependency locks, TypeScript build, package audits, Django permission tests, framework check, and migration consistency check are recorded in [verification](VERIFICATION.md).
- `@stellar/freighter-api` 6.0.1 compiles into the local browser bundle. Actual Testnet signing has not been verified: the user-controlled Freighter extension/wallet probe has not been run. Do not ask for or record a recovery phrase or private key.
- Wrong-token, wrong-network, and wrong-code-hash deployment-preparation checks require the Task 2 contract/WASM and Task 4 preparation code. No deployment is authorized by this setup work.
- `python manage.py check --deploy`, persistent evidence restore, private upload/download, and browser workflow checks remain future task gates.

## Unknown transaction

Disable replacement signing for the unresolved intent. Preserve operation ID, intended body/version, signed envelope hash, last observed ledger and timestamps privately. Query the same hash and read the verified contract. Confirm success only after matching expected result/state; confirm failure only from definitive evidence. Run the future `reconcile_chain` command every 15 seconds while demo is active and after restart. Short database locks surround updates only, never RPC.

`NOT_FOUND`, a local timeout, or a browser disconnect is not proof of failure. Do not rebuild a payout blindly. A retry, if allowed by current Stellar guidance, reuses the exact signed envelope. Reconcile old sequence usage before a new action. The system plan's narrowly defined post-expiry refund exception requires ledger time beyond the old envelope time bound, funded/unpaid contract state and payout expiry; preserve unknown historical outcomes.

## Expiry, holds and appeals

Read actual ledger time and contract state. Before payout cutoff, the sponsor cannot reclaim a funded award early. After cutoff, sponsor signs `refund` to the original sponsor address; holds/rejection and unavailable verifier cannot block recovery. Test with another short-deadline award. No operator override, recipient redirection, or real-money recovery promise exists.

Claims can be reopened only under the contract's signer/deadline rules. An off-chain request for changes or dispute does not cancel a confirmed payout or automatically hold funds. Show this accurately in support screens.

## Compromise, archival, reset and restart

- Verifier issue: sponsor may rotate before review cutoff. Clear prior approval per contract; update app award membership only on confirmed rotation. Unknown rotation grants no new private access.
- App account compromise: suspend app access separately; a session reset cannot revoke a blockchain key. Stop signing new actions while investigating. Lost sponsor/recipient keys have no admin recovery in v1.
- Archived contract/code: preserve identifiers/hashes, restore through supported vendor mechanisms after authorization, then re-read. Do not reconstruct as Created.
- Testnet reset: mark deployment unavailable and stop actions. Record the old network snapshot; obtain an explicit new demo/reseed decision. Never present redeployment as recovery of vanished test funds.
- App restart: restore DB and evidence consistently, reconcile recorded operations, and re-read contract snapshots before enabling actions. A DB status alone cannot authorize money movement.

## Evidence retention and backups

Use persistent private storage; back up files and their database manifests together. Restrict backups to operators; test restore in an isolated environment. Demo evidence is purged 30 days after payout/refund; backup copies expire within 30 further days. Keep non-PII financial/audit references, not evidence URLs. `purge_evidence` must support a preview/report before destructive execution and must not delete funded awards. Unsettled evidence retention needs explicit review if a demo is left running; do not run a blanket purge based on upload age.

## Hosted or real-user launch

A hosted demo requires explicit destination/provider/budget, HTTPS, secure cookies, persistent storage, backups, safe logs, secrets management and deployment checks. Mainnet/real users require a separately approved scope, real demand evidence, contract/security/privacy/legal review, asset/cash-out decision, operational key recovery, and ongoing ownership. The current authorization covers local implementation only; it does not authorize publishing, paid services, Mainnet, a grant submission or external outreach.
