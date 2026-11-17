<p align="center">
  <img src="docs/brand/fundora-logo.png" alt="Fundora" width="280" />
</p>

<p align="center"><strong>Open. Verify. Transact.</strong></p>

# Fundora

**Fundora** pays training stipends only after completion is verified. A sponsor funds an award, a participant submits private evidence, an independent verifier approves it, then the sponsor releases payment on **Stellar** — so money moves with a clear proof trail, not on trust alone.

**Tagline:** Open. Verify. Transact.

**Tags:** `stellar` · `soroban` · `nextjs` · `supabase` · `freighter` · Trust & Transparency · Community Empowerment · Blockchain-Ready

---

## About

Fundora is built for **community workshops and training cohorts**. Sponsors define fixed stipend terms, participants upload completion evidence privately, verifiers decide independently, and sponsors authorize payout. Evidence stays off-chain; Stellar records the approvals and transfers your organization can audit.

Brand values:

| | |
|---|---|
| **Trust & Transparency** | Separated roles; approvals and payouts are inspectable on-chain |
| **Community Empowerment** | Designed for real training programs and cohort stipends |
| **Blockchain-Ready** | Soroban award contracts with Freighter wallet signing |

Logo & brand kit: [docs/brand/](docs/brand/)

> Historical note: the codebase and some docs may still say **ProofPay** until the UI rename pass. Rules and architecture are the same product.

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

1. Sponsor defines a workshop program (immutable terms + deadlines).
2. Admin provisions users and wallets.
3. Sponsor creates one award per participant and funds it.
4. Recipient uploads private evidence → **SUBMIT** (wallet sign).
5. Verifier reviews → **APPROVE** / reject / hold (wallet sign).
6. Sponsor **PAY**s the fixed stipend once (wallet sign).
7. After payout cutoff, unpaid funds can be recovered per contract rules.

---

## Architecture

```text
┌─────────────┐     session / API           ┌──────────────────────────────┐
│  Browser UI │ ←─────────────────────────→ │  Next.js (web/)               │
│  Freighter  │     signed transactions     │  route handlers + SQL         │
└──────┬──────┘                             └──────────────┬───────────────┘
       │                                                   │
       ▼                                                   ▼
┌─────────────┐                             ┌──────────────────────────────┐
│ Stellar     │  reconcile / chain reads    │ Supabase                     │
│ Soroban RPC │ ←────────────────────────── │ Auth · Postgres · Storage     │
│ award WASM  │                             └──────────────────────────────┘
└─────────────┘
```

**Trust boundaries**

- **UI + Freighter** — users sign; no server-held wallet secrets.
- **Next.js server** — sessions, permissions, prepare/submit/reconcile, evidence finalize.
- **Supabase** — Auth, Postgres, private evidence storage.
- **Soroban award contract** — fund / submit / approve / pay / expiry rules; one contract instance per award.

---

## Tech stack & layout

| Piece | Choice |
|---|---|
| App | Next.js + React (`web/`) |
| Data / auth / files | Supabase |
| Contract | Rust / Soroban (`contracts/award/`) |
| Wallet | Freighter (browser) |
| Tests | Vitest, Playwright, cargo, pgTAP |

```text
web/          Next.js + Supabase application
contracts/    Soroban award contract
supabase/     Migrations, config, db tests
oracle/       Archived comparison fixtures
docs/         Engineering docs + brand kit
docs/brand/   Official Fundora logo
```

---

## Status

| Item | State |
|---|---|
| Product path | Next.js + Supabase (`web/`) |
| Preview | https://proofpay-preview.vercel.app |
| Live wallet path | Freighter SUBMIT → APPROVE → PAY |
| In-app Fundora labels | Coming in a follow-up UI rename |

---

## Quickstart

1. Docker Desktop, Node 22+.
2. From repo root: `npx supabase start`
3. Copy `web/.env.example` → `web/.env.local` (from `npx supabase status`)
4. `npm --prefix web install && npm --prefix web run dev` → http://127.0.0.1:3000
5. Contract tests: `cargo test --manifest-path contracts/award/Cargo.toml --locked`
6. App checks (from `web/`): `npm run typecheck` · `npm test`

More: [docs/OPERATIONS.md](docs/OPERATIONS.md)

---

## Security & privacy

- Evidence objects are private; access is authorized and time-bounded.
- No secret keys, recovery phrases, or personal evidence in Git or logs.
- Wallet material stays with the user (Freighter); the server never holds signing keys.

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
| [Product and scope](ProofPay_Product_and_Scope.md) | Users, boundaries, acceptance criteria |
| [System and implementation plan](ProofPay_System_and_Implementation_Plan.md) | Architecture, ABI, implementation tasks |
| [Architecture guide](docs/ARCHITECTURE.md) | Trust boundaries |
| [HTTP interfaces](docs/HTTP_INTERFACES.md) | API shapes |
| [Verification matrix](docs/VERIFICATION.md) | Acceptance evidence |
| [Operations](docs/OPERATIONS.md) | Local / preview ops |
| [Brand kit](docs/brand/README.md) | Logo assets |

OpenSpec: [docs/OPENSPEC.md](docs/OPENSPEC.md).

---

## License

License for original Fundora work is TBD. Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
