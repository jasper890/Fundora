# Chain security checkpoint: live submission paused

The user requested a safe pause before the chain work was complete. **Do not resume live Testnet submission yet.** The submit API and LiveRpc fail closed with `LIVE_SUBMISSION_REVIEW_REQUIRED`, even if the old local environment enables submission. Keep that temporary guard until the blockers below are implemented, tested and independently reviewed; network submission still requires explicit user authorization afterward.

## Saved changes, not complete acceptance

- Signed envelopes are checked against the exact stored prepared body/hash, assigned source/signature, Testnet network hash, operation shape and fee boundary. Fee-bump/changed-body/wrong-signature cases have local tests.
- The submit path locks the operation, persists its real hash before RPC and handles repeat signed requests without automatically submitting again. Unknown outcomes retain the same hash.
- Reconciliation claims a terminal outcome under a row lock and reads contract state before projecting a live success. This needs concurrency and real-response tests before acceptance.
- Live state/native-SAC/network/code-hash checks were added against the installed SDK's typed APIs; live behavior has not been proved by this checkpoint.
- Shared eligibility helpers, UUID verifier replacement, role-specific hold application and TTL version behavior received partial corrections. Helpers alone do not prove route integration.
- Contract source and Django comparison source remain unchanged.

## Critical work to do next

1. Rewrite preparation to reserve BUILDING atomically before simulation, replay the same idempotent intent, reject changed intent and serialize source/award reservations safely. The late-insert preparation path is still incomplete.
2. Integrate current contract-state/version checks and action eligibility consistently into preparation, including FakeRpc. Prevent fake confirmed successes for contract-invalid actions.
3. Bind SUBMIT to the exact current stored evidence and APPROVE/REJECT/REOPEN to the appropriate recorded review/evidence/version. Verify source-check requirements are enforced on the server.
4. Resolve the selected same-program replacement verifier to its immutable wallet before building XDR. Change award membership/access only after confirmed rotation; invalidate old approval and old-verifier access.
5. Test terminal confirmation exactly once under concurrent refresh/cron, timeout after submission, stale envelopes, signed replay, both hold owners, TTL version invariance and all recovery boundaries.
6. Independently review the new live state parser and identity checks against real sanitized RPC structures and the contract's exact instance layout. Reject missing/archived/reset state; never invent a new deployment or confirmed success.
7. Verify historical locally recorded operation states can be resumed safely after these changes. Do not reset the current demo database or resend its unknown operations.

Run TypeScript/lint/unit gates first, then isolated Supabase/Playwright with FakeRpc and submissions off. Only after the full independent gate passes should the temporary code guard be removed in a separately verified change. Do not unlock it merely because an environment variable is set or to make a demo pass.

Outstanding external gates: manual Freighter SUBMIT → APPROVE → PAY, independently checked balances, held expiry refund, archive/TTL recovery and formal A1–A10 Testnet rehearsal. No network transaction was sent in this pass.
