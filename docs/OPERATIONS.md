# Local setup and recovery procedures

Status: Tasks 2-5 have local implementations. Task 5 recovery, audit/export, synthetic seeding and retention procedures are implemented and locally verified; controlled archival restoration and the full Testnet flow remain open. Task 6 remains. The system plan remains authoritative.

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
- `@stellar/freighter-api` 6.0.1 compiles into the local browser bundle. The user confirms Varial is installed in Brave and Test Net is selected. The app's `/wallet-check/` connection probe and signing paths have not been exercised. Do not ask for or record a recovery phrase or private key.
- Wrong-token, wrong-network, and wrong-code-hash preparation rejection tests now pass locally in Task 4. Live wallet signing/deployment validation remains open. No deployment is authorized by setup work.
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


## Task 3 local preview

Apply `uv run python manage.py migrate --noinput`, then start `uv run python manage.py runserver 127.0.0.1:8000`. Evidence uses `PRIVATE_EVIDENCE_ROOT`; no public media route exists. Downloads are authenticated attachments, and the award's current verifier controls access. Proposed replacements gain none until Task 4 reconciliation changes that assignment. Files are limited to three PDF/PNG/JPEG uploads of 5 MiB each. Signature validation is not malware scanning.

Evidence stays unsigned until a confirmed chain submission. APPROVE/REJECT/REOPEN requests remain pending, and request-changes/dispute records do not themselves modify the contract. Confirmed evidence revision/digest/ledger fields must be populated by Task 4, never inferred from an upload. SQLite or fake chain confirmations are not used for local acceptance.

The development database contains a labeled synthetic UI preview with three provisioned `preview-` accounts and no contract ID; its database-only Funded status is explicitly unconfirmed. No private keys are retained. This is browser-check data, not the reproducible ten-recipient Testnet demo planned for Task 5. Preview credentials are local-only and are not source-controlled.


## Task 4 transaction pipeline

Configure `STELLAR_RPC_URL` (default official Testnet), `STELLAR_NETWORK_PASSPHRASE` (must equal Testnet), `STELLAR_WASM_HASH` (the approved installed hash) and `STELLAR_MAX_FEE` (ceiling at most 10000000 base units). `STELLAR_ALLOW_SUBMISSION` defaults `0`; enable only after explicit network-write/deployment authorization and a user-controlled wallet probe. No private key environment variable is used. Code upload and deployment have not been performed by Task 4.

Build the browser module with `npm.cmd run build`; run wallet boundary checks with `node --test tests/wallet_validation.test.mjs`. After database migration, `uv run python manage.py reconcile_chain` performs one reconciliation pass. `--watch` repeats every 15 seconds while the local demo is active. The command reads saved transaction hashes, records observations, and never builds or resubmits a transaction. Run a pass after restart. Unknown outcomes remain unknown until confirmed evidence is available.

Preparation persists a source reservation before RPC work. An expired unsigned request may be abandoned; signed requests do not expire into failure. A hung BUILDING request remains reserved until its unsigned deadline. Review the existing operation rather than changing its idempotency key to bypass an unresolved action. The narrow ledger-confirmed expired-payout refund rule preserves the old UNKNOWN historical record.

Varial is installed in Brave and the user confirms Test Net is selected. The app's connection-only wallet check, live signing/cancellation/wrong-network exercises, and Testnet deployment/confirmation remain open. Automated wallet account/network and unsigned cancellation checks do not close that manual gate.

## Task 5 synthetic demo and recovery

### Create local demo records

From the repository root, create a labeled local-only cohort:

```powershell
uv run python manage.py seed_demo --prefix task5-preview --preview
```

This creates ten synthetic recipients plus sponsor and verifier users, ten awards, and throwaway public addresses whose signing keys are discarded. It does not fund or deploy anything. Rerunning the same prefix returns the existing ten-award cohort without replacing its wallets or financial state. Passwords are unusable by default; for disposable local accounts that need browser login, provide a local environment variable with `--password-env PROOFPAY_DEMO_PASSWORD` and set it only in the current PowerShell process. Never put the password in the command line, repository, or logs.

For a future Testnet cohort, create a private JSON file outside the repository with exactly these keys: `sponsor`, `verifier`, and `recipients` (an array of ten public Stellar G-addresses). All twelve addresses must be distinct. The file must contain public addresses only: never add a secret seed, private key, recovery phrase, or password. Then run:

```powershell
$walletMapPath = Join-Path $env:TEMP 'proofpay-wallet-map.json'
uv run python manage.py seed_demo --prefix task5-testnet --wallet-map $walletMapPath
```

Seeding still creates database records only. A separate `--prefix task5-expiry --wallet-map $walletMapPath --expiry-test` cohort uses short claim, review and payout windows for the held-refund test. No contract upload, deployment, funding or transaction is performed by `seed_demo`.

### Wallet and network check

In the user's Varial wallet, select **Settings → Network → Current Network → Test Net**. The local page `/wallet-check/` requests the connected public account address and reads the active network; it does not ask the wallet to sign or submit a transaction. A connected address must match the current provisioned program member. The recovery phrase and private key stay in the wallet and are never entered into ProofPay.

### Restart and missing-state recovery

After a local app restart, run a reconciliation pass against saved operations and then refresh the selected program's known deployments:

```powershell
uv run python manage.py reconcile_chain
uv run python manage.py refresh_awards --program $programId
```

`refresh_awards` is read-only against the network. Missing, regressed or contradictory state records an unavailable deployment and preserves its contract ID, financial status and unresolved operation history. It never reconstructs `Created`, refunds, or deploys again. For an archived record, use the supported Stellar restore procedure only in a specifically controlled environment, then reread and verify the state. Public Testnet reset/archival manipulation is not a substitute for that check.

### Evidence retention

Preview eligible evidence before cleanup:

```powershell
uv run python manage.py purge_evidence --program $programId
```

Only evidence for awards observed **Paid** or **Refunded** for more than 30 days is eligible. Review the count and the selected program before executing the irreversible purge:

```powershell
uv run python manage.py purge_evidence --program $programId --execute
```

The purge removes private file contents and private review text while retaining financial rows, operation references and evidence commitments. It never deletes funded or recently settled awards. Backup copies expire within a further 30 days under the existing retention policy. This command has not been run against real user evidence.
