# Proposal

## Why

System-plan Task 6 requires repeatable browser evidence for the three roles, privacy denial, keyboard navigation and unresolved transaction status before the handoff is called complete. The full ten-recipient Testnet flow is intentionally deferred because the user chose not to provision twelve role wallets; this change will record local evidence without implying live-chain acceptance.

## What Changes

- Add and run deterministic local browser coverage for sponsor, verifier and recipient screens, unauthorized evidence downloads, keyboard-only review/signing navigation, and unknown-transaction status.
- Record exact browser/test results, setup, remaining acceptance gaps and a short synthetic usability script for outside testers.
- Run available regression and deployment checks; report staging-only checks as not run when no staging settings exist.

## Capabilities

### New Capabilities

None. This change adds verification and handoff material only; it does not introduce product behavior.

### Modified Capabilities

None. `skip_specs: true` is set because the change has no spec-level behavior change.

## Impact

Task 6 of `ProofPay_System_and_Implementation_Plan.md`; A1-A10 evidence review, especially A3, A8, A9 and A10. Expected scope is browser tests and verification/demo documentation. No application routes, permissions, persistence, network configuration, or production dependencies should change. The live Testnet operation checks remain open and require no keys or private wallet material in the repository.
