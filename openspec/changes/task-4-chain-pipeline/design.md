# Design
## Context
See system-plan section 4, ABI section 3, docs/HTTP_INTERFACES.md, Task 2 contract and Task 3 review intents.
## Goals / Non-Goals
Implement the prescribed pipeline with one Python SDK adapter and the current Freighter bundle. Do not deploy, upload code or spend funds in implementation checks.
## Decisions
Use ChainOperation rows with unique actor/idempotency and unresolved source reservations; short actor/award locks reserve sequence use before RPC. Persist a BUILDING reservation before simulation, then PREPARED bytes/hash/preview before exposing signing. Unresolved operations prevent replacement preparation. Transaction body bytes must match exactly; only one valid classic source signature is accepted. Unknown network responses stay UNKNOWN. Persist signed bytes/hash before sending. Verify network/native SAC executable/WASM identity, confirmed result metadata and current contract terms before updating projection. Observations append rather than overwrite history. Pending review intents bind to exact evidence. Freeze random deployment salt, award commitment and policy nonce/constructor manifest before signing. Missing network state never triggers redeployment.
Use configured fee ceiling (at most one XLM), timeout 120 seconds and bounded HTTP timeouts. Source account credentials only, no arbitrary auth-entry signing. The browser displays preview and asks explicitly before calling Freighter. Poll at most 60 seconds and offer status refresh; reconciliation command runs short cycles with RPC outside locks.
## Risks / Trade-offs
Live wallet probe needs user-controlled Freighter. Mainnet and network writes are disabled by default. Native tests cannot establish public Testnet provenance or history retention. A crash while building leaves a conservative reservation until expiry/recovery; signed outcomes never auto-expire into failure.
## Migration Plan
Add operation/observation models and award manifest/hold projection fields; do not destroy existing evidence or financial rows.
