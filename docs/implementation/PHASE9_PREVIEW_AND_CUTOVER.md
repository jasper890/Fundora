# Phase 9 preview + Phase 10 cutover readiness — 17 November 2026

## Done

- Local hardening + isolated FakeRpc suite green (`499d057`).
- Live unlock blockers closed (`baacba3`).
- Production `npm run build` in `web/` PASSED.
- Supabase Free project `proofpay-preview` (`vttmpwgtnfpowgwdwcwz`, `ap-southeast-1`); migrations applied.
- Vercel Hobby project `proofpay-preview` (framework preset **nextjs**, Node **22.x**); SSO deployment protection disabled for public preview smoke.
- Preview URL **live**: https://proofpay-preview.vercel.app (HTTP 200, ProofPay door chooser).
- Hosted synthetic seed with `PROOFPAY_ALLOW_HOSTED_SEED=1` (program `72708ec4-b87c-4545-aff1-1d27c2a89a9d`, 10 awards). Demo doors: `demo-sponsor` / `demo-verifier` / `demo-recipient-01`.
- Next.js 16: `middleware.ts` → `proxy.ts` (`6df4c81`) — clears prior `MIDDLEWARE_INVOCATION_FAILED`.
- Env on preview: `STELLAR_USE_FAKE_RPC=1`, `STELLAR_ALLOW_SUBMISSION=0`.

## Remaining Phase 9 / follow-ons

1. Optional: `vercel git connect` for push-deploy if GitHub app access to `storms23/ProofPay` is granted.
2. Rotate the Supabase DB password if the URI was shared in chat (update Vercel `DATABASE_URL` after).
3. Freighter live smoke still needs you at the keyboard — see [FREIGHTER_SMOKE_RESUME.md](FREIGHTER_SMOKE_RESUME.md).

## Phase 10 — Django cutover (not executed)

Do **not** cut over until Phase 9 preview smoke is accepted. Django remains the read-only oracle until then.

## Phase 11

Formal A1–A10 Testnet rehearsal remains gated after Freighter path evidence exists. Outside usability / demo video are out of scope for this pass.
