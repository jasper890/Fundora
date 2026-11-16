# Design
## Context
See system-plan Task 5 and sections 2-5, HTTP interfaces, operations retention rules, Task 4 pipeline and brand direction A. Task 4 real-wallet gate remains open.
## Goals / Non-Goals
Implement local recovery, audit and demo tooling. Actual network upload/deployment, wallet signing, controlled live archival and Testnet balance proof remain explicit separate gates.
## Decisions
Recovery reads verified state through the existing RPC boundary outside database locks and refuses missing/regressed/terminally contradictory snapshots. Preserve IDs, financial rows and unknown operations after reset; never redeploy automatically. If a confirmed verifier cannot be mapped to a provisioned member, block verifier access until resolved.
Private exports contain only scoped financial/audit IDs, commitments and transaction references. CSV prefixes in user text are escaped; evidence integrity is verified before export unless intentionally purged. No evidence URL, explanation, private source, rationale or XDR is exported.
Retention starts conservatively when terminal chain confirmation is observed, never from upload/creation time. Purge defaults to reporting eligible counts; explicit execution only after 30 days of Paid/Refunded settlement. Redact evidence content and private review text while retaining financial history and commitment references. Failed deletes fail closed and can be retried; filesystem and database are not one atomic resource.
Seed creates ten recipients and distinct sponsor/verifier accounts. Local preview discards generated signing keys and labels records unconfirmed; a live public-address map is accepted separately. Passwords default unusable, with an optional environment-provided local password. Reruns do not overwrite existing awards/wallets or reset financial state.
## Risks / Trade-offs
Native archive/TTL mocks are not restoration on a network. Missing state is ambiguous; operator investigation/reseed authorization is necessary. Evidence backups expire separately within the documented further 30-day window. No production readiness or outside usability evidence is implied.
## Migration Plan
Add settlement time, deployment error/verifier-sync flags and evidence purge marker without deleting existing rows. Existing terminal rows without observed settlement time are ineligible for automated purge until reconciled.
