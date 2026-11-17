# Backend resumption notes

Target: `Proofpay-next`, branch `feature/testability-hardening`. This is a handoff note for the current authorized implementation; it does not change the six-task roadmap.

## Completed in this pass

- Added `must_change_password` migration and gated normal server pages/API profile lookup until the required first password change. Login routes provisioned users to `/password-change`; the password route checks current password, matching new-password confirmation, same-origin, active app profile, and clears the forced-change flag only after Auth accepts the update.
- Serialized login throttle reservation with `SELECT ... FOR UPDATE` before Auth calls, preventing simultaneous invalid attempts from all passing the five-attempt limit. Local caller-supplied proxy headers no longer select a throttle bucket; Vercel uses its platform-forwarded address.
- Unsafe requests without `Origin` are rejected; no-Origin read-only GET remains supported.
- Refused role, wallet, or active-state changes to program members already referenced by awards. New/unused assignments remain provisionable.
- Removed staff automatic access from award status, export, review, and create-award boundaries. Create-award requires the active assigned SPONSOR and caps the program at 10 awards.
- Added scoped program detail and evidence history/download links; terms and deadlines render in Singapore time. Award details pass active replacement-verifier choices, hold state, sync state, deadlines, and only a not-yet-submitted evidence revision to `WalletPanel`.
- Root owns admin account provisioning, seed/e2e fixture adjustments, isolated database contract tests, and the shared frontend/chain files.

## Verification and remaining gates

- Focused auth, permission, origin, and member-assignment tests passed: 4 files, 17 tests. The first typecheck caught the login profile type and in-progress WalletPanel contract; the profile type has been fixed.
- Root is running the final typecheck/lint and isolated test pass. At the last typecheck, frontend-owned WalletPanel/primary-action props and two chain typing errors remained (`lib/chain/live.ts` LedgerKey iteration and `lib/chain/reconcile.ts` snapshot inference). Re-run checks against the integrated current worktree before claiming a clean build.
- Complete independent actual-screen review and fix/recheck for password change, program details, award evidence history/review, wallet actions, and admin/member flows. Keep review isolated from demo database contents and wallet material.
- Run only authorized isolated smoke flows. Do not use the regular E2E suite against demo data, apply migrations to demo, deploy, push, or send Testnet transactions.
- Phase 9 preview, Phase 10 cutover, and Phase 11 live acceptance remain gated on required external deploy/funding evidence and explicit publish/transfer authorization.
