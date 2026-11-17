# Operations notes

Status: updated 17 November 2026 after Phase 10 Django cutover. Preview is live; Freighter/Testnet submission for Phase 11 needs the operator at the wallet.

## Local development (no cloud required)

1. Install Docker Desktop, Node 22+, and use the repo `web/` npm toolchain.
2. From the repo root: `npx supabase start` (uses `supabase/config.toml`; signups disabled).
3. Copy `web/.env.example` → `web/.env.local` and fill values from `npx supabase status`.
4. `npm --prefix web install`
5. `npm --prefix web run dev` → http://127.0.0.1:3000
6. Contract tests: `cargo test --manifest-path contracts/award/Cargo.toml --locked`
7. App unit tests: `npm --prefix web test`

## Hosted preview

- URL: https://proofpay-preview.vercel.app
- Supabase project: `proofpay-preview` (`vttmpwgtnfpowgwdwcwz`)
- Preview env keeps `STELLAR_USE_FAKE_RPC=1` and `STELLAR_ALLOW_SUBMISSION=0`
- Free-tier notes: Supabase Free pauses after **7 idle days** and has **no automatic backups**. Dump before risky changes: `npx supabase db dump`.
- Vercel Hobby is **personal / non-commercial** (POC/MVP only).

## Live Testnet (Phase 11)

Local flags only when authorized:

- `STELLAR_USE_FAKE_RPC=0`
- `STELLAR_ALLOW_SUBMISSION=1`
- `STELLAR_WASM_HASH=<installed award WASM hash>`

Freighter must sign recipient SUBMIT, verifier APPROVE, and sponsor PAY. See [FREIGHTER_SMOKE_RESUME.md](implementation/FREIGHTER_SMOKE_RESUME.md) and [PHASE10_CUTOVER_AND_PHASE11.md](implementation/PHASE10_CUTOVER_AND_PHASE11.md).

## Secrets

Never commit `.env.local`, service-role keys, wallet secrets, or personal evidence. Browser code receives no server secrets.

## Django rollback

Product Django packages were removed in Phase 10. Full restore: `git checkout django-final`. Archived golden test sources: `oracle/django-tests/`.
