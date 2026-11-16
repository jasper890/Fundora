# Proposal

## Why

ProofPay needs an immutable, independently enforced award contract so funding, review, payout, and expiry recovery do not depend on the web application behaving honestly. Task 2 establishes the contract invariants and negative tests before later tasks add evidence handling or transaction signing.

## What Changes

- Add the single-award Soroban contract and its constructor-bound roles, token, recipient, amount, deadlines, evidence commitment, holds, version, and terminal states.
- Require each mutator to enforce the source-plan signer, state, deadline, and expected-version rules; make payout and expiry refund atomic with their exact token transfers.
- Add invariant tests for constructor validation, role authorization, fixed destinations/token, stale state, deadline boundaries, holds, appeals, transfer rollback, and archived-state handling.
- Build and lint the contract for the supported Soroban WASM target, then record the lockfile and artifact hash. A local pass is not an audit or authorization to deploy.

## Capabilities

### New Capabilities

- `award-contract`: Immutable single-award terms, role-scoped state transitions, and exact one-time funding, payout, and expiry refund behavior.

### Modified Capabilities

None. `openspec/specs/` has no existing capabilities.

## Impact

Adds `contracts/award/{Cargo.toml,Cargo.lock,src/lib.rs,src/test.rs}` and one OpenSpec capability. The contract ABI is new and is consumed by later application transaction-preparation work; there are no existing contract callers. Soroban instance storage holds only public terms and commitments; private evidence remains off-chain. Tests use the pinned SDK baseline and a test-only token contract. Source requirements: system plan sections 3 and Task 2; acceptance criteria A1, A2, A4–A7, and A9. No new production service, credential, wallet secret, network deployment, or application configuration is introduced.
