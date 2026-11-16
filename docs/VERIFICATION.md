# Verification and completion evidence

Status: Task 1 local baseline evidence recorded; Task 2 contract implementation and local release verification are complete; live Testnet, archival recovery, private evidence, application integration, and acceptance criteria A1-A10 remain incomplete. Historical upstream example results in the [repository report](../ProofPay_Repository_Validation.md) are not ProofPay test results. The [system plan](../ProofPay_System_and_Implementation_Plan.md) remains authoritative.

## Task 1 implementation record — 16 November 2026

Working snapshot: commit `c70cf04` on branch `implementation/task-1-app-boundary`, managed worktree `C:\Users\R O G - S T R I X\.codex\worktrees\b84f\Proofpay`. Host shell: Windows PowerShell. Tool versions: Python 3.13.15; uv 0.12.21; Django 5.2.19; stellar-sdk 17.0.1; psycopg/psycopg-binary 3.3.9; Node 24.19.0; npm 11.17.0; TypeScript 7.0.2; esbuild 0.28.2; PostgreSQL 17.12; Rust/Cargo 1.99.1; Stellar CLI 28.1.0; Docker 29.8.1. Installed Rust WASM target: `wasm32v1-none`. See [operations](OPERATIONS.md) for the local database boundary.

| Check | Result | Evidence |
|---|---|---|
| `uv sync --locked` | PASSED | Locked 23 Python packages installed and consistent. |
| `docker compose up -d db` and `uv run python manage.py migrate --noinput` | PASSED | Isolated PostgreSQL 17.12 container healthy on loopback port 55432; both ProofPay migrations applied. |
| `uv run python manage.py test proofpay.tests.test_permissions` | PASSED | 11 tests, including anonymous redirects/password change, CSRF, unrelated-award 404, staff payout denial, distinct users/wallets, valid classic-address check, active membership, and 5-failure login throttling. The initial access-control red run exposed the expected 200-vs-404 and 501-vs-403 failures before the fix. |
| `uv run python manage.py check` | PASSED | No issues. |
| `uv run python manage.py makemigrations --check --dry-run` | PASSED | No model changes missing from migrations. |
| `uv pip check --python .venv/Scripts/python.exe` | PASSED | Installed packages are compatible. |
| PowerShell: `$auditFile = Join-Path $env:TEMP 'proofpay-audit-requirements.txt'`; `uv export --locked --format requirements.txt --no-hashes --no-emit-project --output-file $auditFile`; `uvx --from pip-audit pip-audit --requirement $auditFile` | PASSED | No known Python dependency vulnerabilities reported. |
| `npm ci` | PASSED | Clean install from `package-lock.json`; npm reported 0 vulnerabilities. npm warned that esbuild's install script was not approved; the locked optional Windows binary works and the build passed without running that script. |
| `npm run build` | PASSED | Strict ProofPay TypeScript check passed; esbuild produced the ignored 16.6 KB Freighter bundle. `skipLibCheck` is enabled because Freighter 6.0.1's published declarations contain unresolved internal aliases and a Node `Buffer` reference. |
| `npm audit` | PASSED | 0 vulnerabilities. |
| Dependency license inventory | PASSED | [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) lists locked Python/browser package licenses. No upstream app or contract source was adapted in Task 1. |

**Open gates at the Task 1 checkpoint:** Freighter 6.0.1's build/type surface was verified, but the manual Testnet signing probe was **NOT RUN**; Freighter was not found in the checked Chrome/Edge profiles, and no user-controlled wallet signature was requested. Deployment-preparation checks for wrong token, network, and WASM code hash were **NOT RUN** because the contract/hash and Task 4 preparation handler did not exist then. Task 2 has since produced a local WASM hash; the preparation handler and wallet probe are still open. No Testnet deployment or network transaction occurred.

At the Task 1 snapshot, no contract invariant suite, private evidence upload/download, chain action, real Testnet balance check, browser end-to-end run, outside usability test, hosted deployment, or customer pilot had passed. Commit `c70cf04` is the independently testable local baseline; Task 1's wallet and deployment-preparation gates remain open.

| Scope criterion | Owner task | Minimum proof | Planned checks | Current result |
|---|---|---|---|---|
| A1: fixed synthetic program and distinct roles | 1, 2, 5 | Ten synthetic recipients; equality of role users/wallets rejected; all amounts 200000000 | `test_permissions`; contract constructor tests; seed verification | PARTIAL: database role checks and Soroban constructor constraints pass; seeded ten-recipient demo is not implemented. |
| A2: funding actually confirmed | 2, 4, 5 | Exact sponsor/contract token balance change and expected state | Contract fund tests and independent Testnet read/hash | PARTIAL: local bound-token balance/state tests pass; independent Testnet read/hash is NOT RUN. |
| A3: evidence privacy | 3 | Anonymous/unrelated/old verifier download denied; authorized access succeeds | `test_evidence`, `test_permissions` | NOT RUN: page access tests pass; private evidence routes are not implemented. |
| A4: approve then pay once | 2, 4, 5 | Current verifier approval, sponsor signature, immutable recipient balance increases once | Contract authorization/balance tests and demo transaction records | PARTIAL: local authorization and fixed-recipient payout tests pass; demo transaction evidence is NOT RUN. |
| A5: invalid payout blocked | 2, 4 | Wrong signer, missing approval, hold, deadline, duplicate and redirect attempts move no funds | Contract negative tests; signed-body mutation tests | PARTIAL: local negative contract tests pass; signed-body mutation tests are pending Task 4. |
| A6: stale evidence/rotation invalidated | 2, 3, 4 | Old version rejected; confirmed rotation removes old access; unknown rotation grants none | Named rotation/revision tests and app access tests | PARTIAL: local stale-version, rotation, and reopened-revision tests pass; private evidence access tests are pending Task 3. |
| A7: expiry recovery | 2, 5 | Every funded unpaid state refunds after cutoff despite holds/missing verifier | Boundary/hold tests; separate expiry Testnet award | PARTIAL: local cutoff and held-refund tests pass; live expiry recovery remains NOT RUN. |
| A8: unknown outcomes never duplicate | 4, 6 | Timeout stays unknown; concurrent workers/idempotent retries settle once | `test_chain`, browser unknown-state scenario | NOT RUN |
| A9: rollback/restart recovery | 2, 4, 5 | Failed token transfer rolls back; restart rebuilds chain snapshots | `test_recovery`, contract rollback tests | PARTIAL: local mock-token rollback passes; application restart/reconciliation tests remain pending. |
| A10: reproducible demo and truthful labels | 5, 6 | Setup followed from clean environment; Testnet/synthetic visible; checks and limits recorded | Browser walkthrough; demo record; setup reproduction | NOT RUN: Task 1 clean installs/build pass; full demo not implemented. |

## Proposed commands

```text
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test proofpay.tests
cargo test --manifest-path contracts/award/Cargo.toml --locked
cargo fmt --manifest-path contracts/award/Cargo.toml -- --check
cargo clippy --manifest-path contracts/award/Cargo.toml --all-targets -- -D warnings
npm ci
npm run build
```

Task 1 must create the package build script and lockfiles before those commands can be used. Use current supported Soroban WASM target/toolchain and record exact release-build invocation/hash after compatibility checking; no unverified build command is invented here. Browser test runner and command are selected/recorded when `tests/e2e/test_stipend_flow.py` is created. Staging checks include `python manage.py check --deploy` with actual staging settings; local development warnings cannot be represented as a secure hosted deployment.

Contract tests must pin exact cutoff equality (`<=` for claim/review/pay and `>` for refund), every mutator's signer and stale version, state transitions, hold ownership, rotation, transfer rollback, TTL and archival interpretation. At least some tests assert specific expected authorization, rather than letting `mock_all_auths` mask missing checks. App tests cover CSRF, object scope, immutable evidence, corrupted/mismatched uploads, signed-body mutations, sequence contention, concurrent reconciliation, and storage retention.

Manual wallet checks cover rejection, wrong account/network, explicit preview, keyboard focus, stale tab, disconnect, and refresh while unknown. Mark manual checks separately from automated checks. Mocked expiry/archive/reset checks are not live network evidence. Public Testnet reset cannot be triggered merely to complete a test.

## Completion record format

For each task record: commit or working snapshot, requirement IDs, environment/tool versions, exact command/manual procedure, date, exit/result, counts, evidence reference, limitations, and remaining failure. Status is PASSED, FAILED, BLOCKED, or NOT RUN. Store only sanitized screenshots and chain hashes; no passwords, real evidence, or signing material. A skipped check stays incomplete.

Independent usability testers and customer interviews are separate evidence categories. No outside testers exist by assumption. A successful synthetic technical demo does not establish demand, grant eligibility, audit, or production readiness.

## Task 2 initial red record - 16 November 2026

Working snapshot: branch `implementation/task-2-award-contract`, following pushed OpenSpec checkpoint `483b199`. Tool versions: Rust/Cargo 1.99.1, Soroban SDK 28.0.0, Stellar CLI 28.1.0, target `wasm32v1-none`.

| Check | Result | Evidence |
|---|---|---|
| `cargo fetch --manifest-path contracts/award/Cargo.toml --locked` | PASSED | Resolved the exact `soroban-sdk` 28.0.0 pin and generated the committed lockfile. |
| `cargo test --manifest-path contracts/award/Cargo.toml --locked --no-run` | PASSED | All 24 native contract tests compile against the pinned SDK. |
| `cargo test --manifest-path contracts/award/Cargo.toml --locked` | FAILED (expected initial red) | 24 tests compiled; 9 constructor/setup checks passed and 15 lifecycle checks failed because contract transition methods are deliberate `InvalidState` stubs. This records the pre-implementation red run, not final acceptance. |
| `npx.cmd --yes @fission-ai/openspec@2.0.0 validate task-2-award-contract --strict` | PASSED | Proposal, award-contract scenarios, design, and tracked task list validated before test implementation; rerun after updates. |
| `stellar network settings --network testnet --output json-formatted` | NOT RUN for compatibility evidence | The read-only response warned Testnet protocol 30 while Stellar CLI 28.1.0 supports protocol 28 and said the returned configuration may be incomplete. No TTL constants were selected from it, and no Testnet transaction was sent. |

The native suite uses G-address account fixtures from `MuxedAddress::generate`, checks the constructor's recorded sponsor authorization, inspects successful account auth trees, and rejects calls with a specific wrong-signer mock. SDK 28's contract-registration test helper records constructor auth rather than testing its denial path; a signed deployment check is not attempted here. The mock token is test-only and does not prove live SAC behavior. Live Testnet compatibility and archive restoration remain later-phase gates.

## Task 2 implementation checkpoint - 16 November 2026

Working snapshot: Task 2 branch after `57331b4`, with the contract implementation and final verification in this checkpoint. Tool versions: Rust/Cargo 1.99.1, Soroban SDK 28.0.0, Stellar CLI 30.0.1, target `wasm32v1-none`. Stellar CLI was upgraded from 28.1.0 to 30.0.1 because Testnet is on protocol 30. The updated read-only `stellar network settings --network testnet --output json-formatted` completed without a compatibility warning and reported `state_archival.max_entry_ttl = 3110400` and `min_persistent_ttl = 120960`. The contract extends instance/code TTL when below 120960 ledgers to 1000000 ledgers, including construction, business writes, and the permissionless extension method. Recheck these values before deployment.

| Check | Result | Evidence |
|---|---|---|
| `cargo test --manifest-path contracts/award/Cargo.toml --locked` | PASSED | 26 native contract tests passed; includes one-time bound-token funding, fixed-recipient payout, post-cutoff refund, rollback, wrong-signer, deadline, hold, rotation, appeal, TTL extension, missing-state, and lifecycle event checks. |
| `cargo fmt --manifest-path contracts/award/Cargo.toml` | PASSED | Applied formatting before the passing test run. |
| `cargo fmt --manifest-path contracts/award/Cargo.toml -- --check` | PASSED | Formatting check completed without differences. |
| `cargo clippy --manifest-path contracts/award/Cargo.toml --all-targets -- -D warnings` | PASSED | All targets linted with warnings treated as errors. |
| `$env:CARGO_HOME = (cmd.exe /c 'for %I in ("%USERPROFILE%\.cargo") do @echo %~sI'); stellar contract build --manifest-path contracts/award/Cargo.toml --locked` | PASSED | Stellar CLI 30.0.1 built and optimized a 12,854-byte WASM. CLI and `Get-FileHash -Algorithm SHA256` both reported `bfc28602f0461cf447c72c44e31c70da9ca11965e66f51e3ec1d60be99db40d8`. The short-path Cargo home enabled the CLI's dependency path remapping. |
| `npx.cmd --yes @fission-ai/openspec@2.0.0 validate task-2-award-contract --strict` | PASSED | Task 2 change validated after its spec/task updates. |
| Testnet transaction or archival restoration | NOT RUN | No transaction was sent; native tests do not prove live SAC behavior or archive restoration. |

Implementation follows the system plan's rule that an `Approved` or `Rejected` award must be reopened by the current verifier before the recipient can submit the next revision. The contract uses an internal verifier/revision/digest approval record, emits public history events without private evidence, checks expected versions before authorization or side effects, and maps any bound-token transfer failure to a rollback-triggering contract error. The local mock proves atomic rollback only against the test token. Task 2 has not been deployed, uploaded, or audited.
