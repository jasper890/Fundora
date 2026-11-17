# ProofPay orchestration checkpoint

Workspace: `Proofpay-next`, branch `feature/testability-hardening`, starting commit `0d005f8`.
The accepted Next.js/Supabase ADR owns runtime architecture; the original six tasks and A1–A10 still own product and contract behavior. This ledger tracks the existing rebuild phases, not a replacement roadmap.

## Ownership and current status

**PAUSED at the user's request because the usage allowance is nearly exhausted.** Continue only after the user says to continue. The unfinished work is committed on `feature/testability-hardening`; do not discard it or start from the older documentation-only worktree.

| Work | Owner | Status |
|---|---|---|
| Account/password, program detail, evidence history, authorization and member safety | Luna coordinator/backend | IN PROGRESS |
| Brand, responsive role dashboards, navigation, shared UI and motion | Luna frontend | IN PROGRESS |
| Signed transaction validation, state rules, idempotency and reconciliation | Luna chain engineer | IN PROGRESS |
| Independent technical findings and actual-screen review/fix/recheck | Separate Luna reviewer | Static review done; runtime review pending |
| Isolated tests, evidence storage boundaries, integration and evidence ledger | Host | IN PROGRESS |

Final safe checkpoint checks after agents stopped editing:

| Check | Result |
|---|---|
| `npm run typecheck` in `web/` | PASSED |
| `npm run lint -- --quiet` in `web/` | PASSED, no lint errors; full warning cleanup not claimed |
| `npm test` in `web/` | PASSED: 18 files, 73 tests |
| `npm run test:isolated -- --db-only` | PASSED: 7 pgTAP database/security checks against fresh synthetic local data |
| `cargo test --manifest-path contracts/award/Cargo.toml --locked --quiet` | PASSED: 28 contract tests |
| Frozen contract/Django-source diff | No changes |
| Final production build, expanded browser suite, actual UI review | NOT RUN / incomplete at this checkpoint |
| Live Freighter, hosted preview, cutover, live A1–A10 | NOT RUN; separate gates remain |

All implementation agents have been stopped for the pause. Test containers created by this run have been stopped. The checkpoint is committed and pushed; no deployment, demo migration/reset or live transaction was performed. The live submit API and LiveRpc intentionally reject submission with `LIVE_SUBMISSION_REVIEW_REQUIRED` pending completion of the chain security work.

## What is explicitly unfinished

1. **Transaction preparation remains a security blocker.** The prepare route still needs atomic BUILDING reservation, exact idempotency replay, current contract-state checks, correct evidence/review binding and complete verifier-replacement handling. New helpers do not prove they are integrated into every route. Live submission must stay blocked until this is implemented and independently reviewed.
2. **Wallet secondary controls and their full browser flows** need completion/review: holds, cancellation, rejection/reopening, verifier replacement, expiry refund and TTL. Inspect `UI_RESUME.md` and current source rather than assuming the controls are wired.
3. **Independent review of final security fixes** and regression coverage for concurrent reconciliation, repeated submissions, timeout outcomes, reviewer rotation and private-file permissions remain incomplete.
4. **The expanded browser suite has not passed.** New tests cover account provisioning/forced password change, wrong-current-password denial, concurrent login throttling, role access, actual evidence-byte download/privacy, preparation/submission replay and responsive screenshots. They require the isolated runner; the ordinary E2E command refuses unsafe test targets.
5. **Production build and actual-screen UI review/fix/recheck** remain outstanding. No final screenshot, keyboard/accessibility or mobile-quality approval has been obtained.
6. **Original broader acceptance gaps** remain: live balances, held expiry refund, archive/TTL recovery, reproducible full-cohort Testnet rehearsal, outside usability sessions and demo video.
7. **Phases 9–11 are not complete.** Hosted preview, Django cutover and formal live acceptance retain separate authorization gates. No local database or wallet profile may be copied to a cloud preview.

## Resume order

1. Read this ledger plus `BACKEND_RESUME.md`, `UI_RESUME.md`, `CHAIN_RESUME.md`; inspect Git status on the existing branch. Read the accepted runtime ADR and current source requirements.
2. Run each command separately from `web/`: `npm run typecheck`, `npm run lint`, `npm test`. Fix any remaining integration errors before starting new scope.
3. Complete the transaction-preparation blockers with meaningful tests; preserve the temporary live-submission gate until independent approval. Do not use existing Freighter wallets for automated tests.
4. Run `npm run test:isolated` for fresh local Supabase/pgTAP/Playwright verification. It uses separate ports, freshly seeded synthetic data and FakeRpc, and stops its own containers afterward. Never run migrations, reset or seed against the interactive demo database as a test shortcut.
5. Start `npm run test:isolated -- --serve` only for the independent reviewer to inspect the actual app. Complete the review/fix/recheck cycle and then stop that isolated server/stack.
6. Record exact final checks and all remaining external gates before considering any phase complete. No commit/push/merge is requested by this checkpoint.

## Baseline evidence from this execution

- Existing unit suite: **24 tests passed** before implementation.
- Existing contract suite: **28 tests passed**, unchanged contract source.
- Initial lint: **FAILED**: generated `.next-e2e` files were included and a server configuration helper was mistaken for a React hook. Corrected output ignores and renamed the helper and callers; subsequent lint had no errors and one pre-existing unused-directive warning.
- First isolated browser attempt: **FAILED during build** while newly added validation types were being corrected. It did not use the interactive database or send transactions.
- New signed-envelope boundary tests: **7 passed** after confirming the installed SDK's typed signature and hash APIs.
- New action eligibility tests: **4 passed**.
- New test-target safety tests: **8 passed**; reject the interactive database ports, remote hosts and live submissions.

Tests after all integration changes and independent runtime review are still required. These entries are not a claim of release readiness.

## Safety and external gates

- Local test runner creates a fresh Supabase stack on separate ports with synthetic records, FakeRpc enabled and network submission disabled. It does not reset or seed the existing local demo database.
- Local Supabase data, environment files, private evidence and Freighter wallets remain on this machine. No dumps or wallet profiles are copied into Git or uploaded.
- Contracts remain unchanged; Django remains the read-only comparison oracle. No commit, push, merge, cloud deployment, cutover or Testnet submission has been performed by this execution.
- Further live Freighter smoke, phase 9 preview, phase 10 cutover and phase 11 Testnet rehearsal remain separately gated. A preview must use separately authorized fresh synthetic data, never a copy of the local database.
- Outside usability testers and live recovery/balance evidence cannot be replaced by agent review or FakeRpc.

## Usage pause and resume

The requested pause threshold is interpreted as **25% usage remaining**. Account quota is not exposed to the agent. When the user reports the threshold, stop new assignments, preserve safe work, update this checkpoint and wait for “continue.”

Resume by reading this ledger, `CODEX_HANDOFF.md`, the rebuild plan and current Git status. Recheck current results before claiming previously recorded tests still pass. Do not reseed or reset the interactive database.
