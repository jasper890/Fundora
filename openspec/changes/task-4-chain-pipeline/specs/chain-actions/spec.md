# Spec Delta
## Purpose
Ensure wallet-authorized award actions retain exact intent and ambiguous network outcomes cannot cause duplicate payouts, per system-plan Task 4.
## ADDED Requirements
### Requirement: Preparation is scoped and idempotent
The system SHALL validate actor, parameters, current version, Testnet network/native token/code identity and fee ceiling before exposing persisted prepared bytes.
#### Scenario: Duplicate key
- **WHEN** the actor repeats an identical key and intent
- **THEN** the existing operation SHALL be returned; changed intent SHALL return conflict
#### Scenario: Invalid provenance
- **WHEN** network, token, code, source or fee validation fails
- **THEN** signing preparation SHALL fail
### Requirement: Signed bodies are immutable
The system SHALL compare prepared and signed body bytes, verify the assigned source signature and persist the signed hash before submitting the stored envelope.
#### Scenario: Mutated envelope
- **WHEN** a signature uses the wrong network or body or extra operations
- **THEN** the submission SHALL be rejected without network writes
### Requirement: Confirmation requires evidence
The system SHALL retain pending and unknown results until decoded authoritative results and matching contract state establish an outcome, and SHALL serialize unresolved source usage.
#### Scenario: Timeout and concurrent reconciliation
- **WHEN** a submit times out or two workers check the same transaction
- **THEN** the system SHALL preserve unknown status or apply one confirmed projection, never prepare duplicate payment
### Requirement: Wallet interaction shows exact intent
The system SHALL display network, signer, fixed destination, asset, amount, deadline and maximum fee before explicit signing and SHALL handle rejection, wrong account and wrong network.
#### Scenario: Unresolved payment
- **WHEN** a payment outcome remains unknown
- **THEN** the UI SHALL offer refresh and SHALL NOT show payment success or a replacement pay action
