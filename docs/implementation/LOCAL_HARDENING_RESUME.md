# Local hardening continuation — 17 November 2026

Continues `4b8361200f7e180b0dc9c1d700a52d32a938537f` on `feature/resume-local-hardening`. The user authorized resuming, using Luna with xhigh reasoning for subagents and Sol for orchestration, and pushing safe checkpoints to this branch and `dev`. The previous pause is lifted. This is the existing local hardening phase; preview deployment, Django cutover and live Testnet acceptance remain separate gates.

## Scope and progress

- Transaction preparation: atomic BUILDING reservation, exact idempotency replay, state/evidence/review binding and active verifier replacement implemented; focused route/helper checks pass. Real database/browser integration remains pending below.
- Submit rechecks bound evidence/review/replacement under the award lock, rejects stale local evidence before payment, and confirms the bound review only after FakeRpc success. Older unsigned preparations without binding metadata fail closed and must be abandoned/reprepared; recorded signed/unknown operations are retained.
- Wallet secondary controls, pending-evidence guidance, and associated unit/component tests implemented. AppShell now exposes the semantic main landmark used by the skip link.
- Reconciliation: preserve newer state and unsigned evidence during late polls; persist unknown outcomes on unreadable post-state; terminal observations remain serialized.
- Live state reads: bind immutable constructor terms to the stored deployment manifest; reject malformed hold flags. Live submission remains blocked by `LIVE_SUBMISSION_REVIEW_REQUIRED` in both API and gateway.
- Evidence finalization: reject expired upload reservations both before storage reads and after locking the reservation.
- Evidence begin/finalize prevent a second unsigned local revision and prevent finalization while an award transaction is unresolved. This retains sequential contract revisions and closes the upload/approval race. Historical inconsistent local records are retained rather than silently edited.
- Independent review, isolated browser verification and rendered UI review — IN PROGRESS.

The existing `award.evidence_revision/digest` fields track the latest local upload. This continuation preserves that behavior so upload counters, existing records and UI callers remain compatible. Chain preparation must independently establish the confirmed commitment; reconciliation retains a newer or conflicting local commitment and marks it as requiring synchronization.

## Evidence

- Starting checkpoint: TypeScript and quiet lint passed; 18 unit test files / 73 tests passed.
- Root regression tests first reproduced missing evidence projection, older-poll state rollback, unreadable post-state persistence, local evidence overwrite, missing immutable identity checks and expired upload acceptance. Targeted tests pass after corrections.
- Integrated intermediate check: TypeScript and quiet lint passed; 21 unit test files / 103 tests passed. Other implementation work was still in progress, so these are not final acceptance results.
- Root focused suite: 24 tests passed across live-state, reconciliation and evidence finalization. The independent Luna xhigh review found no blocking issue in those live-state/reconciliation changes; the parser fixtures use SDK-generated synthetic XDR, not a captured live RPC response. Contract suite: 28 passed with unchanged contract source.
- Next intermediate suite: quiet lint and 25 unit files / 130 tests passed. TypeScript initially caught an incomplete prepare-query row type after adding evidence authorship; the row type was corrected and TypeScript then passed. Preparation's focused checks passed 4 files / 21 tests. The independent reviewer found no blocking issue in submit binding or the locked evidence-race guards.
- First isolated run: fresh synthetic database checks passed 7/7; browser suite failed 7/9. It exposed a missing main landmark, an administrator login URL wait that matched `/login/administrator` too early, and missing preparation replay. Those defects are fixed in source; green rerun not yet claimed. A second isolated build stopped on the above TypeScript issue before browsers ran. Both runners stopped only their own test stacks.
- Production build, expanded isolated browser suite and actual rendered UI acceptance: pending.
- No interactive demo database reset, deployment or network transaction performed in this continuation.

Read `ORCHESTRATION_PROGRESS.md` and the three original resume notes for historical context. This file records later evidence; historical claims of unfinished work are closed only by specific results here.
