<p align="center">
  <img src="docs/brand/fundora-lockup.svg" alt="Fundora" width="360" />
</p>

<p align="center"><strong>Open. Verify. Transact.</strong></p>

<p align="center">
  <img src="docs/brand/fundora-app-icon.svg" alt="Fundora icon" width="64" />
</p>

# Fundora

Conditional training stipends on **Stellar Testnet**: a sponsor funds awards, a recipient submits private evidence, a verifier approves completion, and the sponsor separately releases payment. The chain records approvals and transfers; a human still checks the underlying record.

> Formerly developed as **ProofPay**. Authority docs and the running UI may still use that name until a dedicated rename pass. Product and contract rules are unchanged.

**Tags:** `stellar` · `soroban` · `testnet` · `nextjs` · `supabase` · `freighter` · Trust & Transparency · Community Empowerment · Blockchain-Ready

---

## About

Fundora is a small, Testnet-only prototype for **community workshop stipends**. One sponsor offers a fixed **20 Testnet XLM** award to each of up to **10** synthetic participants. A separate verifier reviews attendance/completion evidence. Only after approval can the sponsor pay. Evidence files stay **private off-chain**; the ledger sees digests, roles, and transfers—not personal documents.

This is a demonstration stack. Screens say **Testnet XLM — no real monetary value**. No Mainnet, no real funds, and no claim of grant approval or production readiness.

### Brand values

| | |
|---|---|
| **Trust & Transparency** | Separated roles; approvals and payouts are inspectable on-chain |
| **Community Empowerment** | Built for small training cohorts, not generic grant ERP |
| **Blockchain-Ready** | Soroban award contracts + Freighter wallet signing on Stellar Testnet |

Logo concept sheet: [docs/brand/fundora-logo-concept.jpg](docs/brand/fundora-logo-concept.jpg) · Brand kit: [docs/brand/](docs/brand/)

---

## Who it’s for

| Role | Does | Cannot |
|---|---|---|
| **Sponsor** | Set terms, fund awards, release approved payouts, recover unpaid funds after expiry | Act as the verifier |
| **Recipient** | Read own terms, submit evidence, follow own award | Approve or redirect payout |
| **Verifier** | Review evidence; approve, reject, or hold | Move funds |
| **Administrator** | Provision users and program membership | Sign chain actions or override payment |

On-chain sponsor, recipient, and verifier addresses must differ. Admin status alone confers no payment authority.

---

## How it works

1. Sponsor defines a workshop program (immutable terms + UTC deadlines).
2. Admin provisions demo users and public wallets (no public signup).
3. Sponsor creates one award per recipient and funds it on Testnet.
4. Recipient uploads private evidence → prepares **SUBMIT** → signs with Freighter.
5. Verifier reviews → prepares **APPROVE** (or reject/hold) → signs.
6. Sponsor prepares **PAY** → signs; recipient receives the fixed stipend once.
7. After payout cutoff, unpaid funds can be recovered per contract rules.

---

## Architecture

```text
┌─────────────┐     cookies / Origin      ┌──────────────────────────────┐
│  Browser UI │ ←──────────────────────→ │  Next.js (web/)               │
│  Freighter  │     signed tx (client)    │  route handlers + SQL         │
└──────┬──────┘                           └──────────────┬───────────────┘
       │                                                 │
       │ submit XDR                                      │ service role /
       ▼                                                 │ private Storage
┌─────────────┐                           ┌──────────────▼───────────────┐
│ Stellar     │  reconcile / reads        │ Supabase                     │
│ Testnet RPC │ ←────────────────────────│ Auth · Postgres · Storage     │
│ Soroban     │                           └──────────────────────────────┘
│ award WASM  │
└─────────────┘
```

**Trust boundaries**

- **UI + Freighter** — users sign; no server-held wallet secrets.
- **Next.js server** — sessions, permissions, prepare/submit/reconcile, evidence finalize.
- **Supabase** — Auth (signups off), Postgres + RLS, private evidence bucket.
- **Soroban award contract** — fund / submit / approve / pay / expiry rules; one instance per recipient award.

---

## Tech stack & layout

| Piece | Choice |
|---|---|
| App | Next.js 16 + React 19 (`web/`) |
| Data / auth / files | Supabase (local + hosted preview) |
| Contract | Rust / `soroban-sdk` (`contracts/award/`) |
| Wallet | `@stellar/freighter-api` (browser) |
| Tests | Vitest, Playwright, cargo, pgTAP |

```text
web/          Active Next.js + Supabase app
contracts/    Soroban award contract (frozen ABI intent)
supabase/     Migrations, config, db tests
oracle/       Archived Django golden tests (not runnable)
docs/         Engineering docs + brand kit
docs/brand/   Fundora logo assets
```

---

## Current status (18 November 2026)

| Item | State |
|---|---|
| Product path | Next.js + Supabase (`web/`) |
| Django | Removed from product path; rollback tag `django-final` |
| Hosted preview | https://proofpay-preview.vercel.app (FakeRpc; submissions off) |
| Local live flags | Supported for Freighter rehearsal (`STELLAR_ALLOW_SUBMISSION=1`) |
| Phase 11 Freighter SUBMIT → APPROVE → PAY | Authorized; needs operator wallet signs |
| In-app “Fundora” string swap | Not in this pass (README + logo only) |

---

## Quickstart

1. Docker Desktop, Node 22+.
2. From repo root: `npx supabase start`
3. Copy `web/.env.example` → `web/.env.local` using values from `npx supabase status`
4. `npm --prefix web install && npm --prefix web run dev` → http://127.0.0.1:3000
5. Contract tests: `cargo test --manifest-path contracts/award/Cargo.toml --locked`
6. App checks (from `web/`): `npm run typecheck` · `npm test` · `npm run test:isolated` when needed

More detail: [docs/OPERATIONS.md](docs/OPERATIONS.md)

---

## Security & privacy

- Testnet only in this prototype; never treat balances as real money.
- No secret keys, recovery phrases, or personal evidence in Git, logs, or chain args.
- Evidence objects are private; download paths are short-lived and authorized.
- Preview and local envs use separate synthetic data — do not copy interactive DBs to cloud.

---

## Contributors

- **Jefferson Cruz Tuparan**
- **Ramon Dulatre Bonina**
- **Kench Loyola**

---

## Docs for builders & agents

| Read | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Agent entry instructions |
| [Engineering standard](docs/ENGINEERING_STANDARD.md) | Shared rules & document authority |
| [Product and scope](ProofPay_Product_and_Scope.md) | Users, boundaries, A1–A10 *(historical filename)* |
| [System and implementation plan](ProofPay_System_and_Implementation_Plan.md) | Architecture, ABI, six tasks *(historical filename)* |
| [Architecture guide](docs/ARCHITECTURE.md) | Trust boundaries |
| [HTTP interfaces](docs/HTTP_INTERFACES.md) | API shapes |
| [Verification matrix](docs/VERIFICATION.md) | Acceptance evidence |
| [Operations](docs/OPERATIONS.md) | Local / preview ops |
| [Agent handoff / InstaAward checklist](ProofPay_Agent_Handoff_and_InstaAward_Checklist.md) | Execution gates *(historical filename)* |
| [Phase 10 / 11 notes](docs/implementation/PHASE10_CUTOVER_AND_PHASE11.md) | Cutover + Freighter rehearsal |
| [Brand kit](docs/brand/README.md) | Logo assets |

OpenSpec workflow: [docs/OPENSPEC.md](docs/OPENSPEC.md). Deployment beyond the authorized Hobby preview, Mainnet, real funds, grant submission, and outreach need separate explicit authorization.

---

## License

No public source-code license has been selected for original Fundora / ProofPay work yet. Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
