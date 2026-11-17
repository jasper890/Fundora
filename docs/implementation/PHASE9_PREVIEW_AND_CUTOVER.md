# Phase 9 preview + Phase 10 cutover readiness — 17 November 2026

## Done before this note

- Local hardening + isolated FakeRpc suite green (`499d057`).
- Live unlock blockers closed (`baacba3`): reconcile settles `review_action`; submit checks `intent.evidence.author_id`; live digest `Some(BytesN<32>)` fixture; `LiveRpc.submit` restored behind `STELLAR_ALLOW_SUBMISSION=1` only.
- Production `npm run build` in `web/` PASSED.
- Vercel CLI logged in as `storms23`. GitHub CLI logged in as `storms23`.
- No `.vercel` project link yet under `web/`.

## Phase 9 — progress

Created **new** Supabase Free project `proofpay-preview` (`vttmpwgtnfpowgwdwcwz`, `ap-southeast-1`). Cost quoted **$0/month**. Do **not** reuse `val-skonnect-rebuild`.

Applied remote migrations:

- `proofpay_schema` (tables + private `evidence` bucket)
- `forced_password_change`
- `evidence_upload_reservation_expiry`

Tables exist with RLS enabled and zero rows (fresh synthetic seed still required).

Vercel CLI is logged in as `storms23`. GitHub CLI is logged in. No `.vercel` link under `web/` yet.

## Phase 9 — what is still required from you

1. In Supabase dashboard for `proofpay-preview`, open **Project Settings → Database** and copy the **URI** connection string (or reset the DB password once and paste the URI here in chat / set it yourself in Vercel). The app requires `DATABASE_URL`; the agent cannot invent the DB password.
2. After `DATABASE_URL` is available, say so — then the agent can finish Vercel env + Hobby deploy with:
   - `NEXT_PUBLIC_SUPABASE_URL=https://vttmpwgtnfpowgwdwcwz.supabase.co`
   - anon + service_role keys from the project
   - `AUTH_THROTTLE_SECRET` / `CRON_SECRET` (generated)
   - `STELLAR_USE_FAKE_RPC=1`
   - `STELLAR_ALLOW_SUBMISSION=0`
3. Seed synthetic demo users on the hosted project (local seed script against remote URL only after you confirm). Never copy the interactive local demo database.
4. Confirm GitHub app access to `storms23/ProofPay` if you want Git-based Vercel deploys.

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
