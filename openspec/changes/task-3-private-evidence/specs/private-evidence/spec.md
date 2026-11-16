# Spec Delta
## Purpose
Protect private evidence and bind human review requests to the exact submitted version, following system-plan Task 3.
## ADDED Requirements
### Requirement: Evidence is private and immutable
The system SHALL create new evidence revisions with random nonces, canonical SHA-256 manifests and bounded PDF/JPEG/PNG files, and SHALL verify integrity on access.
#### Scenario: Unsafe or modified upload
- **WHEN** a file is unsafe, oversized, mismatched or later corrupted
- **THEN** the system SHALL reject it without exposing private bytes
#### Scenario: Scoped download and rotation
- **WHEN** an unrelated user or former verifier requests a download
- **THEN** access SHALL be denied, and a proposed unconfirmed replacement SHALL gain no access
### Requirement: Review targets the confirmed current revision
The system SHALL reject stale award versions and mismatched evidence revisions and SHALL record decisions only as pending intents.
#### Scenario: Two stale tabs
- **WHEN** another upload or confirmed state change supersedes the reviewed revision or version
- **THEN** the old form SHALL show a stale warning and SHALL NOT record approval
### Requirement: Review screens explain pending state
The system SHALL display accessible forms, escaped text, private attachments, request changes and disputes without implying chain settlement.
#### Scenario: Saved request
- **WHEN** a review or dispute request is saved
- **THEN** the page SHALL state that it does not itself change the contract
