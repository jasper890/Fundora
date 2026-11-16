# Proposal
## Why
System-plan Task 4 makes browser signatures useful without allowing body mutation or duplicate payment after timeouts. It covers A2/A4-A9 and Task 1 network/token/code gates.
## What Changes
- Persist chain operations, actor/idempotency intents, source reservations and observations.
- Build/simulate allowlisted Testnet invocations, validate signed envelopes and reconcile outcomes.
- Add wallet previews, explicit signing, safe status refresh and reconciliation command.
## Capabilities
### New Capabilities
- `chain-actions`: prepared wallet transactions with bounded fees and authoritative reconciliation.
### Modified Capabilities
None.
## Impact
models/migrations, chain.py, JSON routes, wallet.ts, templates, tests and configuration. RPC calls stay outside database locks. No secret custody. Live deployment/submission remains gated pending explicit authorization.
