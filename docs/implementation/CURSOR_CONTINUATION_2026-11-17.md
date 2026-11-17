# Cursor continuation — 17 November 2026

This is the handoff for the ProofPay work paused by the user. Continue from the existing working tree; do not reset or discard local edits.

## Resume context

- Workspace: `C:\Users\R O G - S T R I X\Desktop\Proofpay-next`
- Current branch: `feature/resume-local-hardening`
- Last committed checkpoint: `60c1d9c` (`fix: reserve and bind prepared award transactions`)
- At pause, `origin/feature/resume-local-hardening` and `origin/dev` both pointed at `60c1d9c`.
- Earlier checkpoints on this branch: `3eac33c` (reconciled state and award identity) and `4b83612` (starting checkpoint).
- User previously authorized pushing safe, verified checkpoints to the feature branch and `dev`. This is not authorization for deployment, live Testnet transactions, Mainnet, or cutover.

Read the repository `AGENTS.md`, `README.md`, `docs/ENGINEERING_STANDARD.md`, the four authoritative handoff files linked there, `docs/implementation/ORCHESTRATION_PROGRESS.md`, and the accepted Next.js/Supabase ADR before changing behavior. Follow the six-task plan and OpenSpec workflow; the authoritative docs own behavior.

## Working tree after this continuation

Local changes preserved and extended (still uncommitted until the user approves a checkpoint):

- `web/app/api/v1/awards/[id]/prepare/[action]/route.ts` — expired unsigned-operation cleanup before the award transaction; duplicate idempotency lookup without opposite lock ordering.
- `web/lib/presentation.ts` and `web/tests/presentation.test.ts` — unsigned correction stays actionable after `SUBMITTED`.
- `web/e2e/recovery.spec.ts` — FakeRpc recovery coverage (cancel, holds, verifier replacement, TTL, held expiry refund).
- `web/app/api/v1/session/password/route.ts` — verify current password via `signInWithPassword` before `updateUser`.
- `supabase/migrations/20261117133000_evidence_upload_reservation_expiry.sql` — `expires_at` on evidence upload reservations.
- `web/lib/chain/rpc.ts` — FakeRpc XDR uniqueness includes version/holds so repeated `SET_HOLD` cannot collide on `signed_hash`.
- `web/components/EvidenceUploadForm.tsx` — after successful save, navigate to the award page (keeps history/download links; avoids wiping confirmation via sync-required gate).
- `web/e2e/helpers.ts` — wait for Sign and submit enabled before clicking.
- `web/app/awards/[id]/review/page.tsx` — fix duplicate `WHERE` in evidence lateral join that rendered “Database unavailable.”
- `web/e2e/fakerpc-lifecycle.spec.ts` — expect award URL after evidence save.

## Verification evidence (this continuation)

| Check | Result |
|---|---|
| `npm.cmd run typecheck` (from `web/`) | PASSED |
| `npm.cmd run lint -- --quiet` | PASSED |
| `npm.cmd test` | PASSED — 25 files / 132 tests |
| `npm.cmd run test:isolated` | PASSED — pgTAP 7/7; Playwright 10/10 (account, authorization×3, FakeRpc lifecycle through PAY, recovery, responsive×4) |
| Responsive screenshots (320–1440) | Captured under `web/test-results/responsive-*`; Sol spot-checked sponsor/recipient 320px — Testnet banner, role shell, no horizontal overflow claimed by assertions |
| Lens UI review (`claude-sonnet-5-5-low`) | PASS — no concrete defect; main landmark + skip link present |
| Lock chain review (`claude-sonnet-5-5-low` / security-review) | Keep `LIVE_SUBMISSION_REVIEW_REQUIRED`. Blockers before live unlock: (1) live `reconcile` does not confirm/fail linked `review_action`; (2) no live parser fixture for `Some(BytesN<32>)` digest. Residual: submit does not cross-check `intent.evidence.author_id` vs DB author |
| Production `next build` outside isolated runner | NOT RUN |
| Live Freighter / Testnet submission / deploy / cutover | NOT RUN — still gated |

Isolated runner used fresh synthetic Supabase on ports 55321/55322, FakeRpc, submissions disabled. Interactive demo stack on 54321/54322 was left untouched. Orphaned `proofpay-test-*` containers from prior aborted runs were removed before retries.

## Cursor continuation order — status

1. Inspect local changes — DONE
2. typecheck / quiet lint / unit tests — DONE (132)
3. `test:isolated` — DONE (green)
4. Screenshot / responsive review — DONE (assertions + spot check; no concrete UI defect)
5. Chain items before live unlock — REVIEWED; gates remain; unlock not authorized
6. Checkpoint/push — WAITING for explicit user OK

## Still outside this pause

Hosted preview (Phase 9), Django cutover (Phase 10), and formal live Testnet acceptance (Phase 11) remain gated. Broader live archive/recovery, external usability, and demo evidence are not supplied by FakeRpc tests. No real wallet secrets, private evidence, or personal storage paths belong in Git or test artifacts.
