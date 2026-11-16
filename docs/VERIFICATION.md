# Verification and completion evidence

Status: Task 1 local baseline evidence recorded; Task 2 contract implementation and local release verification are complete; Task 3 private evidence/review is implemented locally; live Testnet, archival recovery, chain integration, and acceptance criteria A1-A10 remain incomplete. Historical upstream example results in the [repository report](../ProofPay_Repository_Validation.md) are not ProofPay test results. The [system plan](../ProofPay_System_and_Implementation_Plan.md) remains authoritative.

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
| A3: evidence privacy | 3 | Anonymous/unrelated/old verifier download denied; authorized access succeeds | `test_evidence`, `test_permissions` | PARTIAL: private evidence access, corruption, and confirmed-assignment rotation tests pass locally; live chain rotation remains pending Task 4. |
| A4: approve then pay once | 2, 4, 5 | Current verifier approval, sponsor signature, immutable recipient balance increases once | Contract authorization/balance tests and demo transaction records | PARTIAL: local authorization and fixed-recipient payout tests pass; demo transaction evidence is NOT RUN. |
| A5: invalid payout blocked | 2, 4 | Wrong signer, missing approval, hold, deadline, duplicate and redirect attempts move no funds | Contract negative tests; signed-body mutation tests | PARTIAL: local negative contract tests pass; signed-body mutation, wrong-network/signature and idempotency tests pass locally; live signing is NOT RUN. |
| A6: stale evidence/rotation invalidated | 2, 3, 4 | Old version rejected; confirmed rotation removes old access; unknown rotation grants none | Named rotation/revision tests and app access tests | PARTIAL: local stale-version, rotation, and reopened-revision tests pass; private evidence access tests pass locally. |
| A7: expiry recovery | 2, 5 | Every funded unpaid state refunds after cutoff despite holds/missing verifier | Boundary/hold tests; separate expiry Testnet award | PARTIAL: local cutoff and held-refund tests pass; live expiry recovery remains NOT RUN. |
| A8: unknown outcomes never duplicate | 4, 6 | Timeout stays unknown; concurrent workers/idempotent retries settle once | `test_chain`, browser unknown-state scenario | NOT RUN |
| A9: rollback/restart recovery | 2, 4, 5 | Failed token transfer rolls back; restart rebuilds chain snapshots | `test_recovery`, contract rollback tests | PARTIAL: local mock-token rollback passes; concurrent reconciliation and unknown-result tests pass locally; restart/Testnet recovery remains pending Task 5. |
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


## Task 3 private evidence and review - 16 November 2026

Branch: `implementation/task-3-private-evidence`, based on `456d763`. Additive migration 0003 adds immutable-through-app evidence versions/files, pending review actions, and confirmed-evidence projection fields. Brand direction A is applied to login, account, program and award/evidence/review pages using local font fallbacks. No new production dependencies were added.

- FAILED (expected development red): initial missing-module run, then service-stub run failed before evidence/review implementation. These are pre-implementation records, not acceptance passes.
- PASSED: final `uv run python manage.py test proofpay.tests --noinput`: 24 tests, including 13 new privacy/integrity/stale-review tests and the 11 original permission tests.
- PASSED: `uv run python manage.py migrate --noinput` applied 0003; `makemigrations --check --dry-run` reports no missing migrations; Django system check reports no issues.
- PASSED: `npm.cmd run build` completes TypeScript and browser bundle build. Task 4 signing is still unavailable.
- PASSED: strict OpenSpec validation for task-3-private-evidence.
- PASSED: Playwright browser spot checks on localhost: recipient upload succeeds; a second tab with old revision receives HTTP 409 and a stale warning; an approval form opened before another revision receives HTTP 409 with the changed-evidence warning. These use labeled synthetic local data, no chain transactions.
- PASSED: browser visual inspection of desktop login and award/evidence page; 320px viewport reports document width 320px. This is a spot check, not a full accessibility audit or outside usability test.
- NOT RUN: live Testnet evidence submission, chain-confirmed verifier rotation, wallet signing, full end-to-end reconciliation, malware scanning and outside usability testing. Task 4 owns chain projection updates; current tests simulate confirmed assignments and verify that proposed replacements receive no access.

File and manifest hashes are rechecked before review/download. No uploaded bytes or private storage paths are committed. Normal failed writes remove newly written files; a process crash can still leave unreferenced files for later retention/reconciliation tooling. Evidence model immutability is enforced through app services/model saves; database operators can alter data. No authenticity, audit or production-readiness claim is made.


## Task 4 initial pipeline checkpoint - 16 November 2026

Branch `implementation/task-4-chain-pipeline`, based on `91f13fb`. Work in progress, not final acceptance. Added migrations 0004/0005 for persisted operations, source reservations, observations, deployment manifests/holds and affirmative source checks. No public-network transaction or wallet signature was requested.

- Initial chain service stubs produced seven expected failures; core implementation then passed seven tests.
- Current targeted chain run: 20 tests PASSED, including real SDK-generated test-process keys/signatures, changed-body/source/contract/extra-operation rejection, wrong network signatures, idempotency conflict, fee cap, pending vs paid, timeout/NOT_FOUND, concurrent reconcilers, source-confirmation requirement, deterministic deployment salt/result binding and strict expiry refund eligibility.
- Final full app checkpoint: `uv run python manage.py test proofpay.tests --noinput` PASSED 44 tests; contract regression PASSED all 26 tests. Django checks, migration consistency and targeted chain-module Ruff lint PASSED.
- `npm.cmd run build` PASSED; `node --test tests/wallet_validation.test.mjs` PASSED three wallet account/network checks. These are deterministic checks, not a real Freighter probe.
- Read-only `RPCGateway().verify_network()` PASSED against current Testnet: RPC passphrase matched Testnet and the derived native SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` had the built-in Stellar Asset executable.
- Real Freighter signing/cancellation/wrong-network exercise remains NOT RUN: user reports Freighter is not installed or not ready. No extension-controlled wallet flow has passed.
- WASM upload/deployment, live transaction submission and live confirmation are NOT RUN and remain unauthorized. `STELLAR_ALLOW_SUBMISSION` defaults false; the deployed code hash must be explicitly configured and verified before a prepared transaction is exposed.

The signed hash and envelope are persisted before send. RPC calls occur outside row locks; short locks and a conditional source constraint serialize sequence use. Network ambiguity stays UNKNOWN. A refund may release an old payout's reservation only after verified ledger time exceeds both its envelope limit and payout cutoff while the verified contract remains funded/unpaid; the old outcome stays UNKNOWN. Confirmations require matching transaction hash/result metadata, expected post-state and bound terms. Deployment IDs are checked against the saved source/salt/network preimage. Browser previews contain no private evidence or storage paths.


Task 4 local completion checkpoint: 44 app tests, 26 unchanged contract tests, three browser wallet-boundary tests, the browser build, migration consistency, chain-module Ruff checks and strict OpenSpec validation pass. Playwright verified the new module loads from localhost (HTTP 200), renders a synthetic preparation preview, cancels an unsigned request back to an enabled preparation control, and fits a 320px viewport. The preparation/cancellation browser responses were mocks; this did not sign or submit a network transaction. `reconcile_chain` runs successfully with no local submitted operations. The real Freighter cancellation/wrong-network/signature probe remains NOT RUN and prevents marking every Task 4 acceptance item complete.


## Task 5 local recovery, audit and demo checkpoint - 16 November 2026

Branch `implementation/task-5-recovery-demo`, based on `185169a`. Added settlement and deployment-recovery fields, guarded verified-state refresh, preview-first evidence retention, role-scoped program/audit screens, JSON/CSV exports, a ten-recipient seed command and Task 5 operational instructions. The contract production code did not change; two contract boundary tests extend expiry and held-refund coverage.

- PASSED: `uv run python manage.py test proofpay.tests --noinput` — 53 app tests.
- PASSED: `cargo test --manifest-path contracts/award/Cargo.toml --locked` — 28 contract tests.
- PASSED: `npm.cmd run build` and `node --test tests/wallet_validation.test.mjs` — browser bundle and three account/network boundary tests.
- PASSED: `uv run python manage.py check`; `uv run python manage.py makemigrations --check --dry-run` — no framework issues and no missing migration. Migration 0006 was applied to the local database.
- PASSED: `npx.cmd --yes @fission-ai/openspec@2.0.0 validate task-5-recovery-demo --strict`.
- PASSED: Playwright in an isolated browser context logged in as recipient, verifier and sponsor. The program list and award detail showed the unconfirmed chain state; the recipient saw evidence/review request controls, the verifier saw source-check controls, and the sponsor saw private export links. Sponsor CSV and JSON exports both returned HTTP 200 with private/no-store headers and no private evidence or signing-envelope fields. The award audit rendered. No evidence was downloaded or changed, and no chain action was signed or submitted. Browser console reported no errors.
- PASSED: a regression test first failed because the program list displayed the stale database `Funded` value, then passed after it displayed `Not confirmed on-chain` when no confirmed ledger exists.
- NOT RUN: Ruff lint; Ruff is not installed in the locked project environment (`uv run ruff` could not find the executable). No project dependency was added for this optional check.
- User reports Varial is installed in Brave and Test Net is selected. NOT RUN: the local `/wallet-check/` connection probe, wallet signing/cancellation/wrong-network check, and full browser workflow.
- NOT RUN: controlled archived-state restoration and live TTL extension. Mocked/native checks do not establish that behavior on a live network.
- NOT RUN: seeded Testnet funding, evidence submission, independent verifier approval, payout, duplicate rejection, and held expiry refund. No upload, deployment, or transaction was sent. The live flow needs twelve distinct sponsor/verifier/recipient public G-addresses and separate explicit authorization for network writes.

Recovery keeps award identity and unknown operations when chain state is unavailable or regresses; it never infers a fresh unpaid award or redeploys. Export omits private evidence and signing envelopes, and formula-like CSV text is escaped. Purge previews eligible counts and only removes evidence after a Paid/Refunded settlement has been observed for more than 30 days. Task 5 remains open until its controlled archival and live Testnet checks have actual evidence. Task 6 usability and handoff evidence remains next.
