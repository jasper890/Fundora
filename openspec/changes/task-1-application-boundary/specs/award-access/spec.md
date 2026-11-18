## Purpose

Define proposed authenticated award access and independent role assignments before payment implementation. Sources: product sections 3 and 5, system-plan Task 1 and engineering-standard trust boundaries.

## ADDED Requirements

### Requirement: Provisioned sponsors can create community projects
The application SHALL let an active sponsor define completion requirements and ordered future deadlines using an independent verifier from a project they already sponsor. The application SHALL reuse distinct registered wallets and save the project and both memberships atomically. Project creation SHALL NOT fund an award or prepare a chain transaction.

#### Scenario: Sponsor creates a project
- **WHEN** an active provisioned sponsor submits valid terms and a distinct active verifier assignment from a shared project
- **THEN** the application creates a project with both members and no awards

#### Scenario: A verifier assignment is unavailable
- **WHEN** the submitted verifier is inactive, is the sponsor, or lacks an active verifier assignment on a shared project
- **THEN** the application denies creation without persisting a project

#### Scenario: Membership persistence fails
- **WHEN** writing the initial memberships fails
- **THEN** the application rolls back project creation

### Requirement: Private pages require authentication
The application SHALL require provisioned authenticated accounts for private pages and SHALL provide no public signup.

#### Scenario: Anonymous request
- **WHEN** an anonymous visitor requests a private page
- **THEN** the application redirects to login without exposing private data

### Requirement: Award access is scoped
The application SHALL enforce award and program access on the server.

#### Scenario: Unrelated participant
- **WHEN** a participant without access requests an award
- **THEN** the application returns 404 without exposing its contents

### Requirement: Administrator status grants no sponsor authority
The application SHALL require explicit sponsor assignment for payout preparation independently of administrator status.

#### Scenario: Unassigned administrator
- **WHEN** an administrator without sponsor assignment attempts payout preparation
- **THEN** the application denies the action and prepares no transaction

### Requirement: Award roles are distinct
Each award SHALL have distinct sponsor, verifier and recipient users and wallet addresses.

#### Scenario: Repeated user or wallet
- **WHEN** an assignment would repeat a user or wallet across award roles
- **THEN** the application rejects the assignment without persisting an invalid award
