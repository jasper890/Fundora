# Phase 9 preview + Phase 10 cutover readiness — 17 November 2026

## Done

- Local hardening + isolated FakeRpc suite green (`499d057`).
- Live unlock blockers closed (`baacba3`): reconcile settles `review_action`; submit checks `intent.evidence.author_id`; live digest `Some(BytesN<32>)` fixture; `LiveRpc.submit` restored behind `STELLAR_ALLOW_SUBMISSION=1` only.
- Production `npm run build` in `web/` PASSED.
- Supabase Free project `proofpay-preview` (`vttmpwgtnfpowgwdwcwz`, `ap-southeast-1`) created; migrations applied.
- Vercel Hobby project `proofpay-preview` linked from `web/`; env set with FakeRpc on and submissions off.
- Preview deploy URL: https://proofpay-preview.vercel.app
- Hosted synthetic seed completed with explicit `PROOFPAY_ALLOW_HOSTED_SEED=1` (program `72708ec4-b87c-4545-aff1-1d27c2a89a9d`, 10 awards). Demo door logins: `demo-sponsor` / `demo-verifier` / `demo-recipient-01`.
- Next.js 16: `middleware.ts` migrated to `proxy.ts` to fix Vercel `MIDDLEWARE_INVOCATION_FAILED` (`import` outside module).

## Phase 9 — remaining

1. Redeploy after `proxy.ts` lands; confirm https://proofpay-preview.vercel.app returns 200 (not MIDDLEWARE_INVOCATION_FAILED).
2. Optional: Git-based Vercel deploys need GitHub app access to `storms23/ProofPay`.
3. Rotate the Supabase DB password if the URI was shared in chat.

## Freighter live smoke (local or preview)

Still needs **you at the keyboard** for wallet connect/sign. Resume path:

- Award from prior smoke may still exist locally; otherwise create a new award after enabling live flags locally:
  - `STELLAR_USE_FAKE_RPC=0`
  - `STELLAR_ALLOW_SUBMISSION=1`
  - `STELLAR_WASM_HASH=<installed WASM hash>`
- Roles: recipient evidence → SUBMIT → verifier APPROVE → sponsor PAY.
- See [FREIGHTER_SMOKE_RESUME.md](FREIGHTER_SMOKE_RESUME.md).

## Phase 10 — Django cutover (not executed yet)

Cutover means tag `django-final`, remove Django runtime packages/templates from the product path, keep `contracts/` and oracle fixtures for rollback. **Do not cut over until Phase 9 preview smoke is accepted.** Django remains the read-only oracle until then.

## Phase 11

Formal A1–A10 Testnet rehearsal remains gated after Freighter path evidence exists. Outside usability / demo video are out of scope for this pass.
