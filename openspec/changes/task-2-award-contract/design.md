# Design

## Context

Task 1 provides the Django role boundary but no Soroban contract or caller. The source plan pins `soroban-sdk = 28.0.0`, a constructor-deployed immutable instance per award, the SAC token interface, and authorization by the transaction source account. Task 2 has no existing chain state to migrate. See [proposal](proposal.md) and [award-contract spec](specs/award-contract/spec.md).

## Goals / Non-Goals

**Goals:** Preserve the source-plan ABI and transitions; make stale, unauthorized, invalid, and expired actions fail before transfers; prove successful and failed token balance changes in deterministic contract tests; produce a reproducible locked build.

**Non-Goals:** Evidence bytes, application transaction signing/reconciliation, network deployment, a voucher registry, a global administrator, upgrade entry points, or any Mainnet/real-fund workflow.

## Decisions

- **One contract instance and one typed state record.** Store constructor terms, status, monotonic version, latest evidence commitment, approval binding, and holds under a single instance-storage key. A separate initializer is rejected because it creates a reinitialization/front-running path; absent state returns `NotInitialized`, never default `Created`.
- **Validate roles as distinct classic account address types.** `Address::executable()` checks ledger existence, not just address kind, so inspect the first byte of the SDK's canonical `Address::to_string()` StrKey (`G` for account, `C` for contract) and require pairwise inequality. This enforces the planned classic-account role type without requiring unrelated test-ledger entries. Constructor validation and sponsor authorization happen before storing terms.
- **Keep transfer destinations and token out of action arguments.** Load the bound token and immutable sponsor/recipient from stored state; use the SDK token client for only the exact amount. Task 4 remains responsible for independently validating the configured network and native SAC before deployment; the contract does not infer native-token identity from a token name.
- **Check expected version and lifecycle before side effects.** Each business mutator loads initialized state, compares `expected_version`, checks role/state/deadline/holds, applies checked version/revision increments, then saves. For fund, pay, and refund, call `try_transfer`; map any downstream failure to `TransferFailed`. A returned error rolls back the state write and nested token effects atomically.
- **Keep approval binding explicit.** Store the verifier, evidence revision, and digest captured by approval; compare all three at payout. Submission, rejection, reopening, and verifier replacement clear that binding. Rotation also clears only the verifier hold.
- **Expose a narrow public state projection.** `get_state` returns the constructor terms and the status/version/evidence/verifier/approval/hold fields required by the ABI. It does not return names, evidence, rationale, or storage internals.
- **Use bounded ledger-count TTL values.** Extend the instance entry on successful business writes and through the public lifetime method. Set the threshold and target in ledger counts after checking the current Testnet limit; do not derive an assumed number of seconds per ledger. This does not make an archived entry a new award.
- **Test the ABI with a test-only SEP-41 token and inspect account authorization trees.** The token records balances and can reject a transfer. SDK 28's `Address::generate` produces contract addresses, while account-role fixtures use `MuxedAddress::generate`; `MockAuth` registers a mock contract and therefore cannot directly represent those G-address roles. Positive account actions use `mock_all_auths` and assert the exact role, function, arguments, and nested token call via `env.auths()`; negative tests install a specific wrong-signer `MockAuth` and prove it cannot satisfy the stored account role. The pinned official Soroban examples inform the patterns; no full upstream contract is copied.
- **Emit events for state history.** Emit evidence revision/digest, review decisions, hold changes, verifier replacement, and terminal transfers so on-chain history records decisions that current state later supersedes.

## Risks / Trade-offs

- **Immutable deployed code cannot be patched in place** -> keep deployment out of this task; require the source-plan's independent review before any real-value deployment.
- **A contract address can be bound as a token if a caller bypasses the app's deployment gate** -> Task 4 must verify Testnet, native SAC provenance, and the code hash; Task 2 binds the supplied token but does not claim to prove native-asset identity.
- **Native unit tests cannot prove live SAC, authorization, rent, or archive-restoration behavior** -> test state and balances locally, record those limits, and keep live Testnet/archival acceptance for the planned later phases.
- **TTL limits can differ by network** -> verify the current Testnet bounds before fixing ledger-count constants and repeat that check before deployment.
- **The mock token cannot establish interoperability with every token implementation** -> the supported production path remains the plan's verified native Testnet SAC; custom tokens are not an accepted deployment substitute.

## Migration Plan

There is no deployed award state to migrate. Add and lock the standalone contract package, run native invariants and static/build checks, record the WASM SHA-256 and exact tool versions, then commit locally. Do not deploy, upload, or submit the WASM in this phase. Task 4 consumes the generated contract ABI and hash through its separately tested preparation gate.
