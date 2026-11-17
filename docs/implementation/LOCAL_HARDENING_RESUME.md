# Local hardening continuation — 17 November 2026

Continues `4b8361200f7e180b0dc9c1d700a52d32a938537f` on `feature/resume-local-hardening`. The user authorized resuming, using Luna with xhigh reasoning for subagents and Sol for orchestration, and pushing safe checkpoints to this branch and `dev`. The previous pause is lifted. This is the existing local hardening phase; preview deployment, Django cutover and live Testnet acceptance remain separate gates.

## Scope and progress

- Transaction preparation: atomic BUILDING reservation, idempotency, state/evidence/review binding and verifier replacement — IN PROGRESS.
- Wallet secondary controls and associated tests — IN PROGRESS.
- Reconciliation: preserve newer state and unsigned evidence during late polls; persist unknown outcomes on unreadable post-state; terminal observations remain serialized.
- Live state reads: bind immutable constructor terms to the stored deployment manifest; reject malformed hold flags. Live submission remains blocked by `LIVE_SUBMISSION_REVIEW_REQUIRED` in both API and gateway.
- Evidence finalization: reject expired upload reservations both before storage reads and after locking the reservation.
- Independent review, isolated browser verification and rendered UI review — IN PROGRESS.

The existing `award.evidence_revision/digest` fields track the latest local upload. This continuation preserves that behavior so upload counters, existing records and UI callers remain compatible. Chain preparation must independently establish the confirmed commitment; reconciliation retains a newer or conflicting local commitment and marks it as requiring synchronization.

## Evidence

- Starting checkpoint: TypeScript and quiet lint passed; 18 unit test files / 73 tests passed.
- Root regression tests first reproduced missing evidence projection, older-poll state rollback, unreadable post-state persistence, local evidence overwrite, missing immutable identity checks and expired upload acceptance. Targeted tests pass after corrections.
- Integrated intermediate check: TypeScript and quiet lint passed; 21 unit test files / 103 tests passed. Other implementation work was still in progress, so these are not final acceptance results.
- Root focused suite: 24 tests passed across live-state, reconciliation and evidence finalization. The independent Luna xhigh review found no blocking issue in those live-state/reconciliation changes; the parser fixtures use SDK-generated synthetic XDR, not a captured live RPC response. Contract suite: 28 passed with unchanged contract source.
- Production build, expanded isolated browser suite and actual rendered UI acceptance: pending.
- No interactive demo database reset, deployment or network transaction performed in this continuation.

Read `ORCHESTRATION_PROGRESS.md` and the three original resume notes for historical context. This file records later evidence; historical claims of unfinished work are closed only by specific results here.
