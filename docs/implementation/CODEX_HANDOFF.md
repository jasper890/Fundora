# Codex handoff — ProofPay Next.js rebuild (17 November 2026)

Copy this into Codex (or open it in the **Proofpay-next** worktree). It records what was decided, what landed, what is in-flight, and what remains. Authority docs still win on product/contract conflicts.

---

## 1. Where to work

| Item | Value |
|---|---|
| **Active app worktree** | `C:\Users\R O G - S T R I X\Desktop\Proofpay-next` |
| **Docs-only snapshot** | `C:\Users\R O G - S T R I X\Desktop\Proofpay` (not the running Next app) |
| **App root** | `Proofpay-next/web/` |
| **Current branch** | `feature/testability-hardening` (uncommitted hardening + e2e as of this handoff) |
| **Prior feature tip (committed)** | `feature/freighter-live-smoke` / commits through `724ba5c` (fee ceiling + expire-before-prepare) |
| **Plan owner doc** | `docs/implementation/NEXTJS_SUPABASE_REBUILD_PLAN.md` |
| **Hardening plan** | `docs/implementation/TESTABILITY_HARDENING_PLAN.md` |
| **Live smoke resume** | `docs/implementation/FREIGHTER_SMOKE_RESUME.md` |

Read first: `AGENTS.md`, `docs/ENGINEERING_STANDARD.md`, then the four ProofPay authority docs. OpenSpec does not override them. **No subagent delegation unless the user asks.**

---

## 2. Decisions already settled

| Decision | Status |
|---|---|
| Target stack: **Next.js + Supabase (Auth/Postgres/Storage) + Freighter**, Vercel Hobby for personal POC later | Settled |
| **No shared login form** — role doors only (`/`, `/login/[door]`) | Settled |
| Local FakeRpc default until live flags; live Testnet via `STELLAR_USE_FAKE_RPC=0` + `STELLAR_ALLOW_SUBMISSION=1` + `STELLAR_WASM_HASH` | Settled |
| Fee ceiling raised for Soroban deploy (~100M stroops) | Settled (code) |
| **Django not ditched yet** — remains read-only oracle until **Phase 10** cutover | Settled |
| UI scope for current pass: **testability-first shell polish**, not full `ui-mock` / inspo pixel parity | Settled |
| Unsafe caching of evidence, authz, or chain confirmation is forbidden | Settled |
| Phase 9 deploy, Phase 10 cutover, Phase 11 formal A1–A10, and further Freighter Testnet txs each need **separate user authorization** | Settled |
| Demo password (local seed): `ProofPay-Demo-Password-12` — do not commit secrets or real wallet material | Settled |

---

## 3. Phase map (rebuild plan)

| Phase | Goal | Status |
|---|---|---|
| 0 | Plan + ADR | Done (docs) |
| 1–4 | Shell, schema, auth doors, presentation/homes | Done locally (scaffold through homes) |
| 5 | Evidence, review, audit, export | Done locally |
| 6 | Chain prepare/submit/status/abandon + live prepare path | Done locally |
| 7 | Freighter connect/sign UI | Done locally |
| 8 | Create-award + staff admin | Done locally |
| **Hardening (extra)** | Testability A→B→C before more smoke | **Implemented on branch; not committed/pushed as of handoff** |
| 9 | Vercel hosted preview | **Not started** — needs deploy auth |
| 10 | Cutover; remove Django runtime | **Not started** — Django still oracle |
| 11 | Formal Testnet rehearsal / A1–A10 | **Not started** — needs submission auth |

Committed baseline for Phases 5–8 + live prepare fixes: `361f1e1`, `e3450f1`, `724ba5c`.

---

## 4. What we have done (evidence)

### Product / runtime
- Next App Router app under `web/` with Supabase local, seed cohort, role doors.
- Evidence begin/finalize + Storage path; review API; audit/export privacy basics.
- Chain: FakeRpc + LiveRpc prepare/submit/status/abandon/reconcile.
- Freighter WalletPanel (connect / prepare / sign / submit / refresh / abandon).
- Admin members/programs subset; create-award flow.

### Live Freighter smoke (user + agent assisted)
- Award `4a79c055-b003-40d0-9d98-e43d19794e9c`
- **DEPLOY** confirmed — contract `CC5UMIFT7BZ65CO72KACKO7NIBJTYWO552OPSLUXDPLUINGIFQVJOFSP`
- **FUND** confirmed — award **FUNDED**, version `1`
- Recipient for this award: **`demo-recipient-02`** / wallet `GD4R2…` (not recipient-01)
- Sponsor Freighter: `GC35R5…`
- Remaining live path: evidence → SUBMIT → APPROVE → PAY (Freighter clicks; needs user auth to continue Testnet)

### Bugs fixed during smoke / hardening
- Fee ceiling too low for Soroban deploy → raised.
- Stuck PREPARED / unique signer → expire unsigned before prepare; clearer `UNRESOLVED_OPERATION`.
- DEPLOY applied `version + 1` locally while chain stayed at `0` → FUND failed; DEPLOY now keeps **version = 0**; live **contract_id** from tx `returnValue`.
- Wallet showed FUND + PAY together → primary CTA gated by award status.
- Opaque `RPC_UNAVAILABLE` → surface real message; map prep failures more carefully.
- Open op lost on reload → hydrate API + `sessionStorage`.
- Auto-poll after SUBMITTED; readable preview; smoke context strip; nav `aria-current` + Admin link.

### Automated test (not Freighter)
- Headless Playwright **cannot** drive Freighter extension.
- FakeRpc e2e lifecycle **passed**: `web/e2e/fakerpc-lifecycle.spec.ts` (create → deploy → fund → evidence → submit → approve → pay) on port 3001 with `STELLAR_USE_FAKE_RPC=1`, `NEXT_DIST_DIR=.next-e2e`.

---

## 5. What is in flight / dirty on disk

Branch `feature/testability-hardening` had **uncommitted** work including:

- Hardening UI/API (`WalletPanel`, `ChainPreview`, `SmokeContext`, `primaryAction`, `opSession`, open-ops route, apply/reconcile/live/rpc, globals, AppShell, login doors, evidence CSP/`skip_storage` fallback, `http.requireSameOrigin` localhost↔127.0.0.1)
- Docs: `TESTABILITY_HARDENING_PLAN.md`, `FREIGHTER_SMOKE_RESUME.md`, this handoff
- Playwright: `playwright.config.ts`, `e2e/`
- Do **not** commit `web/.next-e2e/`, `web/test-results/`, `.env.local`, or secrets

**Action for Codex:** `git status`; commit only intentional source/docs if the user asks; push only if asked.

---

## 6. Remaining work (ordered)

### A. Finish local hygiene (no cloud)
1. Commit/push `feature/testability-hardening` when user requests.
2. Optionally merge/ff into `dev` when user requests (prior pattern: replace `dev` tip only with explicit instruction).

### B. Resume live Freighter smoke (user must authorize Testnet submits)
Follow `FREIGHTER_SMOKE_RESUME.md`:
1. `demo-recipient-02` — evidence → Prepare submission → Freighter `GD4R2…`
2. `demo-verifier` — review → Prepare approval → Freighter
3. `demo-sponsor` — Prepare payment → Freighter `GC35R5…`

Do **not** send Testnet txs without explicit user authorization in that session.

### C. Later phases (each needs its own auth)
| Next | Needs |
|---|---|
| Phase 9 Vercel preview | Deploy authorization; submission off on preview |
| Phase 10 Django cutover | Parity green; tag `django-final`; user auth |
| Phase 11 A1–A10 formal rehearsal | Submission authorization |
| Full UI rehaul (`ui-mock` / `UI_INSPO_PROOFPAY.jpg`) | Separate authorization; not required for smoke |

### D. Known soft gaps (optional / not blockers for smoke)
- Create-award recipient picker lists users without awards; seeded recipients already awarded so list looks odd (e2e provisions a fresh user).
- Live smoke award recipient is random seed wallet assignment (`demo-recipient-02`), not always `recipient-01`.
- Formal parity suite / full A1–A10 still **NOT RUN** on live Testnet.

---

## 7. How to run locally (quick)

```powershell
cd C:\Users\R O G - S T R I X\Desktop\Proofpay-next\web
# Supabase local up + seed already expected from prior work
npm run dev
# Live Freighter: STELLAR_USE_FAKE_RPC=0, STELLAR_ALLOW_SUBMISSION=1, STELLAR_WASM_HASH set in .env.local (untracked)

# FakeRpc Playwright lifecycle (no Freighter):
$env:E2E_SKIP_BUILD="1"; $env:NEXT_DIST_DIR=".next-e2e"; $env:STELLAR_USE_FAKE_RPC="1"
npx playwright test e2e/fakerpc-lifecycle.spec.ts
```

Demo logins: `demo-sponsor` / `demo-verifier` / `demo-recipient-01`…`10` / `demo-admin` — password `ProofPay-Demo-Password-12`.

---

## 8. Constraints Codex must keep

- Smallest correct change; preserve Stellar auth, privacy, persistence, funds-safety.
- No Mainnet, real funds, AI approval, shared-login regression, product-scope expansion.
- No secrets, personal evidence paths, or wallet seeds in git/logs.
- Do not invent contract IDs, test passes, or grant eligibility — record blockers.
- `contracts/` frozen / byte-identical intent through Phase 9; Django oracle until Phase 10.
- Port, don’t redesign presentation copy (`lib/presentation.ts`).
- Prefer native/helpers over new abstractions; check version-matched Stellar APIs when touching chain.

---

## 9. Suggested first Codex prompts (user picks one)

1. **“Commit the testability hardening on `feature/testability-hardening` (no push).”**
2. **“Resume Freighter live smoke SUBMIT→APPROVE→PAY for award `4a79c055-…` — I authorize Testnet submission.”**
3. **“Plan Phase 9 Vercel preview only (no deploy until I approve).”**
4. **“Do not start Phase 10/11 or full UI rehaul unless I explicitly authorize.”**

---

## 10. One-line status

**Phases 0–8 local Next rebuild largely done; live DEPLOY+FUND proved; testability hardening implemented on branch; FakeRpc Playwright lifecycle green; Django still present until Phase 10; next human gate is Freighter SUBMIT→APPROVE→PAY or commit/push of hardening.**
