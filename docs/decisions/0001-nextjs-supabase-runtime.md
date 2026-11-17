# ADR-0001: Next.js + Supabase runtime (retire Django runtime)

- **Status:** accepted
- **Date:** 17 November 2026
- **Decision owner:** Product owner (storms23), recorded by Cursor agent after explicit architecture revision request

## Context and evidence

ProofPay’s implemented baseline is a Django 5.2.19 web app with PostgreSQL, private evidence files, a Python Stellar/Soroban pipeline (`proofpay/chain.py` ~896 lines), and a small Freighter signing bundle. The Soroban award contract (`contracts/award`, `soroban-sdk =28.0.0`, `AWARD_AMOUNT = 200_000_000`) and acceptance criteria A1–A10 are unchanged product authority.

The owner requires hosting **without a personal always-on machine or DIY VM**, using **free tiers**. That rules out “Django stays the only server” unless a separate always-on app host is rented. Free managed options that fit a no-VM constraint are:

- **Vercel Hobby** for a Next.js app (UI + serverless/Node route handlers). Hobby is personal / non-commercial; the owner confirmed ProofPay is a **personal proof-of-concept / MVP**.
- **Supabase Free** for Postgres, Auth, and private Storage (500 MB DB, 1 GB storage, pause after 7 idle days, no automatic backups, 2 active projects). The org already has one free active slot.

A prior plan kept Django as system of record with Next.js as UI-only, to avoid re-proving the funds path. The owner explicitly reversed that tradeoff on 17 November 2026 in favour of free no-VM hosting.

Vendor limits that shape the design (official docs checked 17 Nov 2026):

- Vercel Functions **4.5 MB** request/response body → evidence (up to 5 MiB) must use **Supabase signed upload/download URLs**, not pass through the function body.
- Vercel Hobby cron **once per day** → reconciliation uses **Supabase `pg_cron` + `pg_net`** (default every 5 minutes) plus on-demand refresh; Hobby cron is only a backstop.
- Django’s chain path uses many `transaction.atomic` / `select_for_update` calls → the TypeScript port must use **direct Postgres** (transaction pooler, `prepare: false`), not only the Supabase REST client.

## Decision

1. **Runtime:** One Next.js App Router application on Vercel Hobby is both the user interface and the application server (route handlers / server components).
2. **Data plane:** Supabase Free provides PostgreSQL, Auth (public sign-up **disabled**; staff provision only), and a **private** Storage bucket for evidence.
3. **Contract:** The existing Soroban award contract remains the money authority; it is **frozen** (no ABI/behaviour change in this rebuild).
4. **Oracle:** Until cutover, the Django app remains in-repo as a **read-only behaviour oracle**. Golden fixtures and ported tests must match before Django is removed. Tag `django-final` at cutover for rollback.
5. **Secrets:** The server never holds Stellar user secrets. Server secrets are limited to Supabase service role, database URL, auth throttle HMAC secret, and cron secret.
6. **Deployment and Testnet submission** each require separate explicit authorization; Phase 0 is documentation only.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| Keep Django + Next.js UI-only | Still needs a host for Django (VM or PaaS); conflicts with no-device free hosting goal |
| Supabase-only (Auth + client RLS as app brain) | Would push authorization and Stellar prep into the browser/client; conflicts with server-side trust boundary and STEM no-public-signup |
| Prisma Postgres + Vercel without Supabase Auth/Storage | Still need auth + private files; does not remove the need to port Django logic |
| Paid always-on Django host (Render/Fly/Railway) | Rejected for this revision’s free / no-VM constraint |
| Wholesale fork (Hypha, OpenSPP, AidFlow) | Already rejected in repository validation |

## Consequences, costs and limitations

- **Cost in engineering:** ~2,800 lines of non-test Python (especially `chain.py`) must be ported to TypeScript and re-proven. Risk of funds-path drift is real; mitigated by oracle fixtures, XDR parity tests, and frozen contract.
- **Free-tier ops:** Supabase may **pause after 7 idle days**; Free has **no automatic backups**. Vercel Hobby is **not** for commercial/org production.
- **Upload architecture** is more complex (signed URL begin/finalize) because of the 4.5 MB function limit.
- **Local dev** still uses Docker via the Supabase CLI stack; that is developer tooling, not production hosting.
- Product exclusions unchanged: no Mainnet, no real money, no AI approval, no public signup, no pooled grants, administrator has no payment/evidence authority.

## Authoritative requirements changed

| Document / rule | Change |
|---|---|
| System plan §1 “do not introduce a Node API” / Django-as-app | Amended: Node/Next.js **is** the application runtime; contract and product rules unchanged |
| `docs/DECISIONS.md` “Original small Django application” and “Server-rendered pages with small signing bundle” | **Superseded** for runtime/UI delivery |
| `docs/ENGINEERING_STANDARD.md` preference for native Django auth/sessions/forms/CSRF/ORM | **Superseded** for runtime; replaced by Auth + Origin checks + zod + SQL |
| Product scope, contract ABI, A1–A10, immutable award terms, private evidence | **Unchanged** |

Supporting docs (`ARCHITECTURE.md`, `HTTP_INTERFACES.md`, `OPERATIONS.md`, `VERIFICATION.md`) must be updated in the implementation phases that change their meaning—not by this ADR alone.

## Implementation and verification references

- Plan: [NEXTJS_SUPABASE_REBUILD_PLAN.md](../implementation/NEXTJS_SUPABASE_REBUILD_PLAN.md)
- Frozen contract: `contracts/award/`
- Oracle modules: `proofpay/chain.py`, `chain_views.py`, `presentation.py`, `permissions.py`, `evidence.py`, `forms.py`, `models.py`, `static_src/wallet.ts`
- Gates: parity fixtures, pgTAP RLS deny-all, cargo 28 tests, Playwright, no secrets in git; Testnet A1–A10 remain NOT RUN until Phase 11 authorization

## Supersedes / superseded by

- **Supersedes:** runtime rows in [DECISIONS.md](../DECISIONS.md) listed above; prior “Next.js UI over Django backend” Cursor plan revision of 17 Nov 2026.
- **Superseded by:** none yet.
