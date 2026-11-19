# ProofPay: product and scope

Prepared 16 November 2026 (Asia/Singapore). Status: design handoff, not a built product, approved award, or validated business.

## 1. Decision and authority

ProofPay is the selected project by the user's latest instruction. It is a conditional-disbursement application: a sponsor funds a program, an authorized verifier reviews a requirement, and Stellar enforces the approval and payment rules.

This package supersedes the **project selection and implementation recommendations** in `ServicePass_AI_Handoff.md`, `ServicePass_GitHub_Repository_Validation.md`, and the conversation's PaymentCheck recommendation. Preserve those historical files. Their repair-shop reuse decisions are not ProofPay decisions.

The original 25-page PDF recommended ProofPay; the later handover deprioritized it because of adjacent aid projects. This handoff does not erase that competitive concern. The user selected ProofPay despite it. The PDF's scores were subjective and are not funding probabilities. It references a Part 7 that is not present in the supplied 25-page file; do not invent the missing content.

Read next: [Repository validation](ProofPay_Repository_Validation.md), [System and implementation plan](ProofPay_System_and_Implementation_Plan.md), [Agent handoff/checklist](ProofPay_Agent_Handoff_and_InstaAward_Checklist.md).

## 2. One initial use case

**Completion-based funding for community projects.** One simulated sponsor offers a fixed 20 Testnet XLM award to each of up to 10 synthetic recipients per project. An independent verifier checks completion against a reliable source, such as a site inspection log. The sponsor then authorizes payout for approved claims.

Why this case: no roof inspection, clinical records, government identity integration, merchant network, lending, or physical inventory is needed. A controlled attendance record can demonstrate independent approval without pretending photographs establish truth. The same workflow may later support other programs, but this sprint implements only this one.

Each participant's award is a separate funded contract instance with one requirement, one recipient, one verifier and one sponsor. The web app groups these awards into a Program. Ten contracts are acceptable for a small demonstration; no large-scale cost claim is made. One contract's failure must not block the other recipients.

**Asset decision:** native Testnet XLM through its Stellar Asset Contract (SAC), not USDC in this first demo. This avoids an extra issuer and trustline dependency. Every screen says "Testnet XLM - no real monetary value". Twenty XLM is 200,000,000 base units at seven decimals. It is not a dollar or peso amount. A later real-asset choice requires its own validation.

## 3. Users and journey

| Role | Job | Deliberately excluded authority |
|---|---|---|
| Sponsor | Define terms, enroll recipient, fund award, release approved payment, recover unpaid funds after expiry | Cannot approve completion as the verifier |
| Recipient | Read own terms, submit evidence, request review, inspect own status | Cannot approve or redirect payout |
| Verifier | Compare evidence with source records; request corrections, approve or reject, place a review hold | Cannot pay themselves or move funds |
| App administrator | Provision accounts, assign permitted program access, support backups and incidents | No contract signing key and no payment override |

On-chain sponsor, recipient and verifier addresses must all differ. Provision separate app users for these three roles on the same award. An administrator can also be a sponsor only through a separate explicit sponsor assignment and wallet; admin status alone confers no chain authority. This is role separation, not a guarantee against real people colluding.

Happy path:

1. A provisioned sponsor creates a community project with immutable completion requirements and UTC deadlines and selects an active verifier from a project they already sponsor. Creating the project records terms and memberships without funding an award.
2. Admin provisions demo users and public wallet addresses; no public signup or identity checks.
3. Sponsor creates one award per recipient. Recipient sees the amount, verifier, deadlines, recovery rules and wallet destination before funding.
4. Sponsor deploys and funds the award through their Testnet wallet. UI waits for confirmed network success.
5. Recipient uploads permitted evidence, sees a reviewable evidence summary and signs its commitment submission.
6. Verifier checks the **original synthetic organizer record**, not only the upload. They sign an approval of that exact evidence commitment, request changes, or reject.
7. Sponsor reviews and signs payout. The contract independently checks state, holds, deadline and authorization and transfers the fixed amount to the immutable recipient.
8. Recipient and sponsor see a confirmed transaction reference; the private audit report includes the evidence version and decision history.

## 4. MVP and exclusions

Included: account login, program-scoped permissions, three role dashboards, private evidence upload/download, one completion condition per award, evidence revisions before approval, explicit review and rejection, two-party payment authorization, holds, verifier replacement, expiry recovery, a readable audit trail, JSON/CSV export, transaction reconciliation, contract and application tests, and reproducible Testnet demo instructions.

Excluded: AI, automatic evidence authenticity decisions, Mainnet, real money, fiat cash-out, SMS, passkeys/embedded wallets (except the Testnet-only phone wallet in [ADR-0003](docs/decisions/0003-built-in-testnet-wallet.md)), sponsored fees, merchant vouchers, multi-party quorum approval, a general rules builder, public crowdfunding, multi-organization SaaS tenancy and insurance. Basic wallet signing is an acceptable business-role UX for this technical demo; future mainstream onboarding is not claimed solved.

**Mobile (added 19 Nov 2026, [ADR-0002](docs/decisions/0002-expo-mobile-client.md)):** a Testnet-only Expo client in `mobile/` that puts recipients first: sign in, view awards, capture or pick evidence, request changes or a dispute. It can create a Testnet-only wallet whose secret key stays in the phone's secure storage ([ADR-0003](docs/decisions/0003-built-in-testnet-wallet.md)). The phone signs SUBMIT, APPROVE and PAY; deployment, funding, holds, rejection, reopening, verifier replacement and refunds stay on the web.

**No services or contracts are deployed by this documentation task.** Test fixtures and deployment scripts are future deliverables, not evidence of completed work.

## 5. Trust, privacy and disputes

- A signature establishes approval by a key. Neither it nor an evidence hash proves physical attendance or identity.
- Prefer a reliable source record, such as an inspection log or a completion record controlled by the organizer and direct confirmation by an independently appointed verifier. A photograph or AI detector score is insufficient by itself.
- A suspicious claim is held. Record what was checked, by whom, and why a decision was made. Never label a claim "fraud-proof" or "blockchain verified attendance".
- Verifier or sponsor can set their own on-chain hold; only its setter can clear it. A hold blocks approval/payout but never blocks the expiry refund. Recipient dispute requests reach these reviewers through the app and are not an automatic payment veto. Disclose this limitation.
- A rejected claim may receive an off-chain appeal review before the payout deadline; a verifier may reopen it on-chain, producing a new event. No payout changes after final settlement. Details are in the system plan.
- Payout is irreversible in this MVP. There is no automatic fraud recovery, adjudicator, or clawback.
- Personal names, email, attendance records, photographs, explanations and file locations remain private off-chain. Public chain data still exposes wallet relationships, amounts and timing. Hashes are not encryption.
- Seed only invented identities. Evidence retention for the demo is 30 days after payout/refund, with deletion from the active store and expiry from backups within a further 30 days; retain non-PII audit fields. This is a prototype retention decision, not a legal compliance finding.

## 6. Assumptions and commercial uncertainty

There are no confirmed users, pilot commitments, customer interviews or Chapter Lead feedback. Planning assumes one web developer and one person competent to implement/review Rust/Soroban; one person may cover both only if capable. No team capacity, hosting budget or grant amount has been established. Do not promise delivery dates or a budget on the user's behalf.

The hypothesis is that independent sponsor/verifier/recipient approvals and payment traceability improve an existing program. Where one organization already controls and trusts the entire workflow, a conventional database plus bank payments may be simpler. The proposed Testnet demo proves mechanics, not blockchain necessity or market demand.

Potential future revenue is organization subscriptions/integration support. No willingness-to-pay evidence or revenue forecast exists. Competing/adjacent systems include Rahat, CHATS, Trustless Work, Hypha/OpenSPP and **two different AidFlow repositories**. The repository report explains why ProofPay cannot claim uniqueness or simply rebrand a clone.

## 7. Acceptance criteria (future targets)

| ID | Observable result |
|---|---|
| A1 | One community project in the acceptance rehearsal, 1 sponsor, 1 verifier, 10 synthetic recipients; each award has fixed 20 Testnet XLM terms and three distinct addresses |
| A2 | Sponsor funds an award; confirmation and actual SAC balance are independently checked |
| A3 | Recipient submits evidence; another participant and unauthenticated user cannot download it |
| A4 | Verifier signs approval; sponsor signs payout; exact amount reaches the enrolled recipient once |
| A5 | Missing approval, wrong signer, hold, expired deadline, duplicate payout and changed recipient attempts fail without moving funds |
| A6 | Revisions invalidate old review references; verifier replacement clears earlier approval and cannot substitute sponsor/recipient |
| A7 | An unpaid award refunds to its original sponsor after expiry, including when held or when an approver is unavailable |
| A8 | A simulated timeout is shown as unknown until reconciled; refreshing/retrying never creates a second payment |
| A9 | Failed transfers leave the award payable/recoverable; restarted app reconstructs state from contract reads and recorded operations |
| A10 | Setup, tests and demo can be reproduced; all accounts/activity are visibly labeled simulated/Testnet |

## Sources and evidence boundary

Local sources: supplied research PDF (entire 25 pages), both original Markdown files and this conversation. None is a validated demand study.

Primary links, retrieved 16 November 2026:
- [InstaAward rules](https://stellar.gitbook.io/scf-handbook/scf-awards/instawards/official-rules): sprint/program context; see the checklist for application obligations.
- [Stellar networks](https://developers.stellar.org/docs/networks): Testnet is free, valueless and resettable.
- [SAC documentation](https://developers.stellar.org/docs/tokens/stellar-asset-contract): native XLM is usable through the built-in SAC; verify the network/asset during implementation.
- [Rahat SCF record](https://communityfund.stellar.org/project/rahat-yuj): adjacent aid product, not ProofPay validation.

The four handoff documents are authoritative for this demo, but all current APIs, deployment prerequisites and legal/program eligibility must be checked again at execution/submission time.
