# Testability hardening before Freighter smoke resume

**Status:** Implementation authorized on `feature/testability-hardening`.  
**Scope:** Testability-first shell polish (not full ui-mock pixel parity).  
**Out of scope:** Phase 9–11, Mainnet, full brand rewrite, new Testnet txs until smoke is re-authorized after exit criteria.

## Findings

| Friction | Root cause |
|---|---|
| Opaque `RPC_UNAVAILABLE` | Prepare catch-all; often wrong `expected_version` after DEPLOY |
| FUND + PAY both primary | Wallet CTAs ignored award status |
| Sign/Refresh lost on reload | Operation id only in React state |
| Manual refresh loop | No client poll after SUBMITTED |
| Raw JSON as main UX | Preview dumped as `<pre>` |
| Wrong demo recipient | Awards not labeled with username + wallet |
| Broken nav current | `aria-current` hardcoded on Programs |

## Phases

- **A — Robustness:** CTA gating by status, hydrate open ops, honest errors, DEPLOY version=0 + live contract id regressions.
- **B — Testability UX:** Readable preview, sessionStorage continuity, auto-poll, smoke context strip, nav/admin fixes.
- **C — Light polish:** Primary/secondary hierarchy, collapsed JSON, spacing.

## Safe continuity vs private

**Allowed:** session cookie; `sessionStorage` for operation id; client poll of status API.  
**Forbidden to cache as truth:** evidence bytes, authz, FUNDED/PAID confirmation (always server/RPC).

## Exit criteria

1. Correct demo user without DB hunting  
2. Next step visible without JSON  
3. One primary wallet action per state  
4. Prepare → readable preview → sign → assisted confirm  
5. Reload mid-flow keeps open operation  
6. Errors name the real problem  

Then Freighter SUBMIT → APPROVE → PAY requires separate user authorization.
