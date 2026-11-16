# Spec Delta
## Purpose
Provide scoped audit, expiry recovery, synthetic demo setup and evidence retention under system-plan Task 5.
## ADDED Requirements
### Requirement: Recovery preserves financial identity
The system SHALL re-read verified state after restart and SHALL preserve existing identity, status and unresolved operations when deployment is missing or state regresses.
#### Scenario: Reset or unavailable deployment
- **WHEN** a known contract cannot be read
- **THEN** the system SHALL record unavailability without inventing Created state, refund or redeployment
### Requirement: Audit exports are scoped and safe
The system SHALL restrict exports to assigned sponsors/current verifiers and SHALL escape CSV formula prefixes while excluding private evidence and signing envelopes.
#### Scenario: Unrelated participant export
- **WHEN** an unrelated user or recipient requests the program export
- **THEN** access SHALL be denied without returning private audit rows
### Requirement: Retention preserves financial history
The system SHALL offer a purge preview and SHALL purge only evidence belonging to Paid/Refunded awards observed settled more than 30 days ago.
#### Scenario: Funded or recently settled evidence
- **WHEN** purge runs against unpaid or recently settled awards
- **THEN** no evidence or financial records SHALL be deleted
### Requirement: Synthetic seeding is reproducible
The system SHALL create ten synthetic recipients with distinct roles and SHALL preserve existing seeded financial state on repeat execution.
#### Scenario: Rerun setup
- **WHEN** an existing synthetic cohort is seeded again
- **THEN** the command SHALL return the existing cohort without recreating awards or replacing wallets
