# ProofPay: agent handoff and InstaAward checklist

Prepared/retrieved 16 November 2026, Asia/Singapore. Status: research/design complete as a handoff; implementation, customer validation and award approval are not complete.

## 1. Read in this order

1. [Product and scope](ProofPay_Product_and_Scope.md): authoritative product decision and acceptance criteria A1-A10.
2. [Repository validation](ProofPay_Repository_Validation.md): exact snapshots, rejected implementations, reuse permissions and actual checks.
3. [System and implementation plan](ProofPay_System_and_Implementation_Plan.md): proposed models, ABI, state transitions, screens, transaction lifecycle and task sequence.
4. This file: handoff constraints, remaining gates, application checklist and source register.

The original PDF and ServicePass Markdown files remain background research. This package supersedes their project selection/reuse recommendations for this task. PaymentCheck is not part of the implementation. The user has selected ProofPay; do not silently switch products, expand into a generic grant ERP, or treat this choice as validated demand.

## 2. Locked decisions

| Decision | Handoff instruction |
|---|---|
| First use case | One synthetic community workshop, fixed completion stipend; at most 10 recipients |
| Money | 20 **Testnet XLM** per award through native SAC; no real value, dollar equivalence or live USDC claim |
| App foundation | Small original Django application; no wholesale Hypha/OpenSPP/AidFlow fork |
| Reuse | Published Python SDK; selectively adapt official Soroban patterns. H/O/B are references; A is rejected |
| Contracts | One immutable, fixed-recipient award instance per recipient; original stipend ABI; no voucher system |
| Trust | Recipient submits, verifier approves source evidence, sponsor separately releases; keys/users differ |
| Privacy | Protected off-chain files; randomized evidence commitments and non-PII chain state |
| Recovery | Unpaid deposit refundable to sponsor after cutoff even while held; no early unilateral funded withdrawal |
| AI | Excluded from MVP; no AI-generated evidence automatically unlocks payment |
| Deployment | Local development, then explicit Testnet demo after authorization; no Mainnet |
| Application | Private provisioned accounts and server-side scoped permissions; wallet signing for chain actions |

No live pilot, user count, commercial volume, audit, production readiness, funds received or award approval is claimed. The illustrations in the conversation were concept art, not screenshots or deployed URLs. The move from the PDF's two-tranche scholarship concept to one completion stipend is an explicit scope reduction. Passkeys, claimable balances, fee sponsorship and USDC were not validated into this MVP.

## 3. Instructions to the coding agent

> Build only the Testnet ProofPay prototype described in these four documents when the user authorizes implementation. Read every document before proposing changes. Use the smallest complete implementation, preserve role separation and private-file access, and implement the contract's negative tests before fund handling. Treat all proposed paths/ABI methods as new work. Use the pinned upstream sources as references and retain notices for adapted code. Do not execute sample secrets, infer a real asset address or deploy placeholder authorization. Keep transaction ambiguity visible and never rebuild a payout merely because a lookup returns NOT_FOUND. If an SDK version is incompatible, record the exact evidence and tested replacement. Keep all personal information and evidence locations off-chain. Document every acceptance criterion as passed, failed or not run. Ask only about genuine blockers; decide routine implementation details within this scope. Do not publish, submit a grant, contact partners or use real money without separate authorization.

## 4. Implementation entry and completion gates

### Before coding/committing a sprint promise

- [ ] Confirm this plan against the actual developer's Python/Rust skills and available time. The 30-day schedule assumes competence, not training from zero.
- [ ] Create an isolated code repository/directory; copy these inputs there, preserve original research folder. No code exists here to migrate.
- [ ] Resolve Task 1 wallet/SDK compatibility and verify native Testnet SAC config using primary docs. Record network, code hash and tool versions. Use no sample Mainnet address.
- [ ] Confirm funding and approved spending before opening any paid hosting account. Local demo is the baseline.
- [ ] Produce dependency/asset license inventory and THIRD_PARTY_NOTICES. Hypha frontend copying remains blocked by conflicting metadata; no third-party full dependency tree has been cleared.

### Before saying the prototype is complete

- [ ] All A1-A10 have reproducible evidence, including wrong-signer and stale/duplicate-payment failures.
- [ ] Contract native tests, WASM build, app tests, privacy tests and browser flow pass for the **actual ProofPay code**, not only upstream examples.
- [ ] Testnet success and expiry refund are independently confirmed with balances and transaction references.
- [ ] Unknown network outcomes, wallet cancellation and restarting the application are tested.
- [ ] No secret recovery phrase, private key or personal evidence appears in source, logs, screenshots or public chain arguments.
- [ ] Evidence storage survives restarts and the purge/backup policy is documented.
- [ ] UI uses readable Testnet labels, keyboard-accessible controls, explicit state text and no guaranteed-success/fraud-proof badges.
- [ ] At least two outside usability testers participate, or that criterion is honestly marked incomplete.
- [ ] Customer interviews/pilot discovery are reported separately from technical or usability tests.

## 5. InstaAward application checklist

**Labels:** R = required by official rules; C = chapter-dependent detail; P = our preparation recommendation. Official source **guidance** is identified separately from a universal requirement. None of these boxes has been completed on the user's behalf.

### Official program requirements/guidance

Source I: [InstaAwards Official Rules](https://stellar.gitbook.io/scf-handbook/scf-awards/instawards/official-rules), retrieved 16 November 2026, sections 2-7 and 8.

| Type | Todo | Present status |
|---|---|---|
| R | Establish active local chapter participation; membership alone is insufficient | Unknown |
| R | Work through the chapter's submission route and identify the assisting lead | Not established |
| R | Agree achievable scope, amount and sprint; normally 30 days or less | Draft only |
| R | Build/preparing to build on Stellar; request early execution support | Proposed |
| R | Complete KYC before disbursement | Not established |
| R | Follow agreed deliverables, reporting and award terms | No award terms exist |
| R | Treat approval/follow-ons as discretionary, not guaranteed | Must preserve |
| P | Use concrete deliverables, direct Stellar relevance and measurable criteria (official scope guidance) | A1-A10 proposed |
| C | Confirm tier, timing, submission materials and check-in schedule | Ask lead |

The published initial range is usually USD 1,000-5,000 in XLM; it is not our request or a promised award. Additional support is conditional. Do not budget as if funding is secured.

### General submission eligibility

Source G: [Official Rules for Submissions](https://stellar.gitbook.io/scf-handbook/scf-awards/official-rules-for-submissions), retrieved 16 November 2026, sections 1-5.

| Type | Todo | Present status |
|---|---|---|
| R | Verify age 18+, sanctions/jurisdiction eligibility and lawful participation | Unknown |
| R | Confirm team/organization eligibility, representative and participation restrictions | Unknown |
| R/C | Address section 1.2's requirement for at least two eligible individuals for listed program activities; clarify applicability with the chapter | Team size unknown; do not assume solo eligibility |
| R | Confirm lawful product, intellectual-property permissions and meaningful Stellar contribution | Not legally determined |
| R | Observe fund-use restrictions, applicable due diligence and re-verification | Not established |
| R | Read current terms on publicity/privacy, fund custody and applicable submission deadlines | Applicant responsibility |
| R | Do not represent SDF funding as product endorsement or security approval | No endorsement claimed |

These are checkpoints, not an eligibility opinion. Apply the actual current wording and award terms, including program-specific exceptions. The complete rules govern if this summary omits a condition.

### Our proposal preparation tasks

- [ ] **P:** Identify a real training organizer/program owner and interview them; no actual partner is required to operate a synthetic demo, but demand remains unproven.
- [ ] **P:** Explain who currently verifies completion, how payments happen, and what measurable problem ProofPay would improve. Compare with normal databases/bank payments.
- [ ] **P:** Explain differentiation from Rahat/CHATS, Trustless Work and both AidFlow repositories. Never claim "first", "no competitors" or an award based on a GitHub README.
- [ ] **P:** Prepare a one-page scope, architecture, a short demo, repository links and test evidence. Video length and form fields are chapter-dependent, not universal rules inferred here.
- [ ] **P:** Make a task-based budget: developer days/rates, testing, deployment and ongoing fees; total must match the proposed scope. Amount is unresolved because capacity/rates are unknown; do not invent a USD 5,000 request.
- [ ] **P:** Maintain weekly progress/evidence logs and explicitly distinguish local tests, Testnet operations, simulated users, interviews and live adoption.
- [ ] **C:** Get feedback on the narrowed scope and amount before submitting; no outreach/submission has been authorized or performed.

## 6. Keep Build Award obligations separate

[Build Award submission criteria](https://stellar.gitbook.io/scf-handbook/scf-awards/build-award/submission-criteria), retrieved 16 November 2026, include validated need/traction, technical readiness, differentiation, contract open-source plans and structured milestones. Additional integration-track metrics and threat-model/monitoring requirements appear there. These are a later pathway, not permission to promise Mainnet or a universal checklist for this first InstaAward. Recheck rules before pursuing that stage.

## 7. Remaining decisions and blockers

| Unknown | Blocks what? | Safe default / next action |
|---|---|---|
| Developer capacity and budget | Credible sprint promise | Use this plan as estimate input; confirm before committing dates/amount |
| Chapter engagement and applicant eligibility | Award submission | User/lead confirms current route and eligibility; no funded status claimed |
| Pilot/customer demand | Commercial claims and a live pilot | Synthetic workshop only; interview potential organizers |
| Browser wallet compatibility | Wallet UI integration | Task 1 probe; documented supported version before rollout |
| Testnet native SAC/config/fees | Signing/deployment | Discover/verify at build; no invented asset address |
| Hosting/storage/secrets provider | Hosted demo | Local default, then explicit deployment setup and persistent private storage |
| Full dependency/asset license/security inventory | Adopting code or public release | Complete in Task 1; references do not grant blanket reuse clearance |
| Production contract/privacy/legal review | Real-money/real-recipient launch | Entirely outside this Testnet scope |

Architecture decisions have been made; the unresolved items above are evidence/environment gaps, not silent placeholders for the coding agent to guess.

## 8. Source register and freshness

All links consulted/retrieved 16 November 2026. Pinned source commits and actual execution results are in the repository report.

| Source | What it supports / limitation |
|---|---|
| Supplied 25-page research PDF | Historical ProofPay recommendation and portfolio sample; not comprehensive, contains unvalidated hypotheses |
| Original ServicePass Markdown files | Prior decisions, privacy warnings and earlier repository checks; not ProofPay scope |
| I / G / Build criteria above | Current public program guidance; review again before submission |
| [Stellar networks](https://developers.stellar.org/docs/networks) | Valueless/resettable testing environment; do not assume persistence |
| [Stellar SAC](https://developers.stellar.org/docs/tokens/stellar-asset-contract) | Native asset/token integration boundary |
| [Stellar docs](https://developers.stellar.org/docs/build/smart-contracts) | Current protocol/tooling checks, not an audit of ProofPay |
| [Django 5.2 security](https://docs.djangoproject.com/en/5.2/topics/security/) | Framework defaults and deployment precautions; business permissions remain our work |
| [Python SDK docs](https://stellar-sdk.readthedocs.io/) | Version-matched transaction interfaces |
| [Hypha docs](https://docs.hypha.app/) | Existing review platform; code-level adoption concerns documented separately |
| [Rahat SCF](https://communityfund.stellar.org/project/rahat-yuj) | Adjacent funded aid product; not an InstaAward record for ProofPay/AidFlow |
| [Trustless Work](https://docs.trustlesswork.com/) | Existing escrow infrastructure to acknowledge, not an adopted dependency |

No external message, application, contract deployment or product implementation was performed in this handoff task. A reviewed repository, passing example suite or generated illustration is not a finished ProofPay system.
