# Operations notes

Status: updated 17 November 2026 for the Next.js + Supabase rebuild. Deploy and Testnet submission still need separate authorization.

## Local development (no cloud required)

1. Install Docker Desktop, Node 22+, and use the repo `web/` npm toolchain.
2. From the repo root: `npx supabase start` (uses `supabase/config.toml`; signups disabled).
3. Copy `web/.env.example` → `web/.env.local` and fill values from `npx supabase status`.
4. `npm --prefix web install`
5. `npm --prefix web run dev` → http://127.0.0.1:3000
6. Contract tests: `cargo test --manifest-path contracts/award/Cargo.toml --locked`
7. Oracle (until cutover): `uv run python manage.py test proofpay.tests --noinput` with the existing Django/Postgres compose if needed for golden fixtures.

## Free-tier hosted caveats (when authorized)

- Supabase Free pauses after **7 idle days**; Free has **no automatic backups**. Dump before risky changes: `npx supabase db dump`.
- Vercel Hobby is **personal / non-commercial** (POC/MVP only).
- Evidence uploads bypass Vercel function bodies via **signed Storage URLs** (4.5 MB function limit).
- Reconciliation: Supabase `pg_cron` / `pg_net` every 5 minutes + on-demand refresh; Hobby cron is daily backstop only.
- `STELLAR_ALLOW_SUBMISSION` stays `0` until explicitly authorized.

## Secrets

Never commit `.env.local`, service-role keys, wallet secrets, or personal evidence. Browser code receives no server secrets.

## Legacy Django ops

Docker Compose Postgres on `127.0.0.1:55432` and Django `runserver` remain available only to regenerate oracle fixtures. They are not the production-shaped runtime after ADR-0001.
