# Phase 10 cutover + Phase 11 rehearsal — 17 November 2026

## Authorization

User authorized Phase 10 Django cutover and Phase 11 A1–A10 Testnet rehearsal on 17 November 2026 (preview accepted by that go-signal).

## Phase 10 — done

| Item | Evidence |
|---|---|
| Pre-cutover tag | `django-final` → `95c690b` |
| Pre-cutover web tests | `npm test` in `web/` — 25 files / 136 tests PASSED |
| Pre-cutover contracts | `cargo test --manifest-path contracts/award/Cargo.toml --locked` — 28 PASSED |
| Removed from product path | `manage.py`, `proofpay/`, `config/`, `templates/`, `static/`, `static_src/`, root wallet `package.json`, Django `compose.yaml`, `pyproject.toml` / `uv.lock`, root Python e2e |
| Kept | `contracts/`, `web/`, `supabase/`, `oracle/django-tests/` (archived golden tests) |
| Active runtime | Next.js + Supabase only |

Rollback: `git checkout django-final`.

## Phase 11 — A1–A10 Testnet rehearsal

Hosted preview stays FakeRpc (`STELLAR_ALLOW_SUBMISSION=0`). Live rehearsal uses **local** `web/` with:

- `STELLAR_USE_FAKE_RPC=0`
- `STELLAR_ALLOW_SUBMISSION=1`
- `STELLAR_WASM_HASH` set (local `.env.local` already carries the installed hash)

### Freighter path (operator required)

Resume award from [FREIGHTER_SMOKE_RESUME.md](FREIGHTER_SMOKE_RESUME.md) if still FUNDED, else create a new award after seed.

| Step | Role | Status |
|---|---|---|
| Evidence + SUBMIT | `demo-recipient-02` | NOT RUN — needs Freighter sign |
| APPROVE | `demo-verifier` | NOT RUN — needs Freighter sign |
| PAY | `demo-sponsor` | NOT RUN — needs Freighter sign |

### Criterion ledger (live Testnet)

| Criterion | Local / FakeRpc / contract | Live Testnet |
|---|---|---|
| A1 fixed synthetic program + roles | PARTIAL/PASS via seed + permissions tests | PENDING operator walkthrough |
| A2 funding confirmed | Contract PASS; prior DEPLOY+FUND smoke recorded | Reconfirm balances after PAY |
| A3 evidence privacy | Local PASS | PENDING against live session |
| A4 approve then pay once | Contract PASS | NOT RUN until Freighter path |
| A5 invalid payout blocked | Contract PASS | NOT RUN live wrong-signer |
| A6 stale evidence / rotation | Local PASS | PENDING |
| A7 expiry recovery | Contract PASS | NOT RUN live held-expiry |
| A8 unknown outcomes | Local PASS | NOT RUN live reconcile |
| A9 rollback/restart | Local PARTIAL | NOT RUN archive/TTL |
| A10 reproducible demo + labels | Preview + seed PASS for labels | Full Testnet demo NOT RUN |

**Blocker for completing Phase 11:** Freighter connect/sign cannot be performed by the agent alone. After the operator finishes SUBMIT→APPROVE→PAY, record tx hashes and mark criteria accordingly.
