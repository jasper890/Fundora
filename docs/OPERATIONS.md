# Proposed setup and recovery procedures

Status: planning runbook, not executable setup instructions. No application, server, contract deployment, or production incident has been operated here. The [system plan](../ProofPay_System_and_Implementation_Plan.md) owns architecture and chain behavior.

## Local implementation entry

1. Inspect the destination repository and developer environment. Use an isolated implementation directory only if application code is still absent. Preserve these sources.
2. Check the proposed Python/Django/PostgreSQL/Rust/SDK/Node baselines against current vendor docs and lock a compatible set. Probe browser wallet signing on Testnet before promising integration.
3. Implement Task 1's application settings, migrations, local PostgreSQL setup, private persistent evidence storage, and tests. Document verified install/setup commands as those files are created.
4. Use separate synthetic role accounts/wallets. Generate demo credentials locally; never commit them. Keep RPC configuration, Django secret, database credentials and storage configuration out of Git. Browser code receives no server secrets.
5. Verify configured Testnet network/passphrase, native SAC identity, allowed WASM hash, fee ceiling and exact terms before asking a user to sign. Never paste a sample asset/contract address from documentation.
6. Before any network deployment or hosted publication, obtain the explicit authorization required by the handoff. Hosting provider, spending limit and privacy/storage setup remain undecided.

## Unknown transaction

Disable replacement signing for the unresolved intent. Preserve operation ID, intended body/version, signed envelope hash, last observed ledger and timestamps privately. Query the same hash and read the verified contract. Confirm success only after matching expected result/state; confirm failure only from definitive evidence. Run the future `reconcile_chain` command every 15 seconds while demo is active and after restart. Short database locks surround updates only, never RPC.

`NOT_FOUND`, a local timeout, or a browser disconnect is not proof of failure. Do not rebuild a payout blindly. A retry, if allowed by current Stellar guidance, reuses the exact signed envelope. Reconcile old sequence usage before a new action. The system plan's narrowly defined post-expiry refund exception requires ledger time beyond the old envelope time bound, funded/unpaid contract state and payout expiry; preserve unknown historical outcomes.

## Expiry, holds and appeals

Read actual ledger time and contract state. Before payout cutoff, the sponsor cannot reclaim a funded award early. After cutoff, sponsor signs `refund` to the original sponsor address; holds/rejection and unavailable verifier cannot block recovery. Test with another short-deadline award. No operator override, recipient redirection, or real-money recovery promise exists.

Claims can be reopened only under the contract's signer/deadline rules. An off-chain request for changes or dispute does not cancel a confirmed payout or automatically hold funds. Show this accurately in support screens.

## Compromise, archival, reset and restart

- Verifier issue: sponsor may rotate before review cutoff. Clear prior approval per contract; update app award membership only on confirmed rotation. Unknown rotation grants no new private access.
- App account compromise: suspend app access separately; a session reset cannot revoke a blockchain key. Stop signing new actions while investigating. Lost sponsor/recipient keys have no admin recovery in v1.
- Archived contract/code: preserve identifiers/hashes, restore through supported vendor mechanisms after authorization, then re-read. Do not reconstruct as Created.
- Testnet reset: mark deployment unavailable and stop actions. Record the old network snapshot; obtain an explicit new demo/reseed decision. Never present redeployment as recovery of vanished test funds.
- App restart: restore DB and evidence consistently, reconcile recorded operations, and re-read contract snapshots before enabling actions. A DB status alone cannot authorize money movement.

## Evidence retention and backups

Use persistent private storage; back up files and their database manifests together. Restrict backups to operators; test restore in an isolated environment. Demo evidence is purged 30 days after payout/refund; backup copies expire within 30 further days. Keep non-PII financial/audit references, not evidence URLs. `purge_evidence` must support a preview/report before destructive execution and must not delete funded awards. Unsettled evidence retention needs explicit review if a demo is left running; do not run a blanket purge based on upload age.

## Hosted or real-user launch

A hosted demo requires explicit destination/provider/budget, HTTPS, secure cookies, persistent storage, backups, safe logs, secrets management and deployment checks. Mainnet/real users require a separately approved scope, real demand evidence, contract/security/privacy/legal review, asset/cash-out decision, operational key recovery, and ongoing ownership. The current handoff authorizes none of those claims or commitments.
