# Spec Delta

## Purpose

Defines the on-chain behavior of one immutable ProofPay award, including its authorized lifecycle, evidence approval, fixed token transfers, and expiry recovery.

## ADDED Requirements

### Requirement: Award terms are immutable and validated at construction

The contract SHALL bind one sponsor, verifier, recipient, token, fixed amount, nonzero award identifier, nonzero policy commitment, and ordered deadlines at construction. The three classic account roles SHALL be distinct, the amount SHALL equal 200000000 base units, and the sponsor SHALL authorize construction.

#### Scenario: Valid award construction
- **WHEN** a sponsor authorizes construction with distinct roles, the fixed amount, nonzero commitments, and `now < claim < review < payout`
- **THEN** the contract SHALL expose those terms in `Created` state with version zero

#### Scenario: Invalid constructor terms
- **WHEN** construction uses equal roles, a nonpositive or non-exact amount, zero commitment, or unordered deadlines
- **THEN** construction SHALL fail without an initialized award

#### Scenario: Missing sponsor authorization
- **WHEN** construction is attempted without the sponsor's authorization
- **THEN** construction SHALL fail

### Requirement: Funding and cancellation follow the created-state rules

Funding SHALL accept only the exact constructor-bound amount and token from the sponsor while the award is `Created` and the ledger timestamp is at or before the claim deadline. Cancellation SHALL be sponsor-authorized and allowed only while `Created`.

#### Scenario: Sponsor funds once at the claim boundary
- **WHEN** the sponsor funds a `Created` award at the claim deadline with the expected version
- **THEN** the bound token SHALL move the exact amount to the contract and state SHALL become `Funded`

#### Scenario: Repeat funding or premature action
- **WHEN** a caller funds after the first successful funding, funds without sponsor authorization, or cancels after funding
- **THEN** the call SHALL fail and token balances and award state SHALL remain unchanged

### Requirement: Mutations require the current role and expected version

Every post-construction mutation SHALL require the role authorized for that action and the current expected version. A stale version or unauthorized signer SHALL fail before any token transfer or state change. Successful mutations SHALL increment the version exactly once.

#### Scenario: Stale signed action
- **WHEN** an action is submitted with a version older than the current award version
- **THEN** the contract SHALL return a stale-state error without changing state or balances

#### Scenario: Wrong role signs an action
- **WHEN** an address other than the role authorized for a mutating action signs it
- **THEN** the contract SHALL reject the action without changing state or balances

### Requirement: Evidence revisions bind approval to current evidence

Only the recipient SHALL submit evidence to a funded or submitted award at or before the claim deadline. An `Approved` or `Rejected` award SHALL first be reopened by the current verifier. Each revision SHALL be the previous revision plus one and have a nonzero digest. Submission SHALL leave approval cleared. Only the current verifier SHALL approve the current submitted revision by the review deadline when neither hold is active.

#### Scenario: New evidence follows reopening of approval
- **WHEN** the current verifier reopens an approved award and the recipient submits the next evidence revision
- **THEN** state SHALL remain `Submitted` and the previous approval SHALL not authorize payment

#### Scenario: Missing funds or invalid revision
- **WHEN** evidence is submitted before funding, with a skipped or repeated revision, or with a zero digest
- **THEN** the submission SHALL fail without changing the stored evidence commitment

#### Scenario: Approval is bound to the current verifier and evidence
- **WHEN** the current verifier approves the submitted revision before or at the review deadline without holds
- **THEN** the contract SHALL record approval for that verifier, digest, and revision

### Requirement: Rejection, appeal, and verifier rotation invalidate old approval

The current verifier SHALL be able to reject a submitted or approved award and reopen a rejected or approved award through the review deadline. The sponsor SHALL be able to replace the verifier before or at that deadline with an address distinct from the sponsor, recipient, and old verifier. Reopening, rejection, and rotation SHALL clear approval; rotation SHALL also clear the verifier hold and preserve the sponsor hold.

#### Scenario: Rejected appeal reopens before cutoff
- **WHEN** the current verifier reopens a rejected award at or before the review deadline
- **THEN** the award SHALL return to `Submitted` with no approval

#### Scenario: Verifier rotation invalidates signed work
- **WHEN** the sponsor replaces the verifier on a nonterminal award before or at the review deadline
- **THEN** the new verifier SHALL become current, old approval and verifier hold SHALL be cleared, and prior-version actions SHALL fail

### Requirement: Holds block payout but not expiry refund

The sponsor and current verifier SHALL be able to set or clear only their own hold on a funded, nonterminal award. Holds SHALL block approval or payout as specified by the lifecycle, but SHALL NOT extend deadlines or prevent an eligible expiry refund.

#### Scenario: Held award cannot be paid
- **WHEN** either hold is active while the sponsor attempts to pay
- **THEN** the payment SHALL fail with balances and state unchanged

#### Scenario: Expiry refund succeeds while held
- **WHEN** the sponsor refunds a funded unpaid award strictly after the payout deadline while one or both holds are active
- **THEN** the exact original deposit SHALL return to the original sponsor and the state SHALL become `Refunded`

### Requirement: Payout is one-time and uses the constructor-bound destination and token

The sponsor SHALL pay only an approved award at or before the payout deadline when approval still matches the current verifier and evidence and no hold is active. Payment SHALL transfer exactly the fixed amount to the constructor-bound recipient through the constructor-bound token; callers SHALL NOT be able to redirect either address.

#### Scenario: Approved award pays once
- **WHEN** the sponsor pays an eligible approved award at the payout deadline with the current version
- **THEN** the recipient SHALL receive exactly the fixed amount and state SHALL become `Paid`

#### Scenario: Missing approval, expired deadline, or repeated payout
- **WHEN** the sponsor pays without a current approval, after the payout deadline, or after a prior payment
- **THEN** the call SHALL fail without moving tokens

#### Scenario: Token transfer failure rolls back payment
- **WHEN** the bound token rejects the payment transfer
- **THEN** the entire call SHALL fail and the award SHALL remain payable with its pre-call balances and state

### Requirement: Expiry refund returns the exact deposit to its source

The sponsor SHALL refund an unpaid funded award strictly after the payout deadline from `Funded`, `Submitted`, `Approved`, or `Rejected` state. Refund SHALL ignore holds and verifier availability and SHALL return exactly the deposited amount through the constructor-bound token to the original sponsor.

#### Scenario: Refund after cutoff
- **WHEN** the sponsor refunds an eligible unpaid award after the payout deadline
- **THEN** the original sponsor SHALL receive the exact deposit and state SHALL become `Refunded`

#### Scenario: Refund at cutoff or after a terminal outcome
- **WHEN** refund is attempted at or before the payout deadline or after payment/refund/cancellation
- **THEN** the call SHALL fail without moving tokens

### Requirement: Public state and lifetime maintenance preserve award identity

Public state reads SHALL expose only immutable terms, status, version, evidence revision and digest, current verifier, approval state, and hold flags. Successful business mutations and the public lifetime-extension action SHALL maintain instance storage lifetime. Missing or archived state SHALL never be interpreted as a new `Created` award or reinitialized through a mutator.

#### Scenario: Public state omits private evidence
- **WHEN** any caller reads award state
- **THEN** the result SHALL contain the specified public terms and commitments but no private evidence or personal information

#### Scenario: Missing state cannot be initialized by an action
- **WHEN** a lifecycle action is invoked without the initialized award record
- **THEN** the call SHALL fail and SHALL NOT create a fresh unpaid award
