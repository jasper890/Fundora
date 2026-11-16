## Why

Task 1 of [the system plan](../../../ProofPay_System_and_Implementation_Plan.md) establishes the application and permission boundary before funds are handled. This is a proposed implementation change; no app exists yet.

## What Changes

- Establish Task 1's reproducible Django baseline, provisioned login and scoped award permissions.
- Resolve dependency, wallet and deployment-provenance gates with evidence.
- Preserve all six source tasks and their acceptance criteria.

## Capabilities

### New Capabilities

- `award-access`: authenticated, scoped award access and distinct role assignments.

### Modified Capabilities

None.

## Impact

Future callers: login, dashboards, award views and transaction preparation. Persistence: documented user/program/award models and migrations. Configuration: Django, PostgreSQL, private storage and signing bundle. Tests: Task 1 permissions, provenance rejection and build checks. Contributes to A1, A3 and A5 without completing them. Sources: product sections 3 and 5; system-plan Task 1.
