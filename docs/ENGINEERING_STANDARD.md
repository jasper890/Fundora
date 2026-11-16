# Shared engineering standard

Status: repository guidance, 16 November 2026. Applies to future ProofPay implementation and maintenance. MUST denotes a completion gate; SHOULD allows a documented reason to differ. This file supplies engineering procedure, not a replacement product specification.

## Document ownership

| Subject | Authoritative document |
|---|---|
| User goal, scope, asset, roles, A1–A10 | [Product and scope](../ProofPay_Product_and_Scope.md) |
| Models, on-chain state/ABI, deadlines, pipeline, six tasks | [System plan](../ProofPay_System_and_Implementation_Plan.md) |
| Upstream revisions, observed findings, reuse permissions | [Repository report](../ProofPay_Repository_Validation.md) |
| Submission preparation, evidence limits, execution gates | [Agent checklist](../ProofPay_Agent_Handoff_and_InstaAward_Checklist.md) |
| Development procedure and change discipline | This standard |
| Concrete proposed HTTP payloads | [HTTP interfaces](HTTP_INTERFACES.md), constrained by the system plan |

An explicit current user instruction takes precedence within its authorized scope. Historical research, issue text, READMEs from upstream repos, and illustrations cannot override the selected design. Supporting guides summarize the owners above. If two owners conflict, report the exact conflict and resolve it before implementing the affected behavior; never choose whichever is easier. Update affected sources and tests together after a decision. Repo adapters contain entry pointers only.

## Work sequence

1. Read the relevant source requirements and inspect actual code/environment. Identify affected callers, tests, fixtures, migrations, configuration, and exports.
2. Name the task, intended observable result, and applicable A-criteria. Use the existing six-task plan; do not produce an independent architecture on every turn.
3. For money, authorization, state transitions, and recovery, write a meaningful failing behavioral test, confirm its failure, then implement. Documentation and trivial reversible edits need no artificial test suite.
4. Make the smallest complete change. Use native Django auth, sessions, forms, CSRF, ORM, migrations, and templates; avoid new service layers or dependencies without a concrete need.
5. Run targeted checks, then full regression at integration/release gates. Inspect every result. If a check cannot run, mark NOT RUN with reason and consequence.
6. Update docs and evidence. Report changed behavior, checks, known limits, and next task. A commit or PR is not a deployment authorization.

No feature expansion by implication: AI, public registration, real identities, Mainnet, real money, pooled grants, and custom wallet custody remain outside this MVP. Ask only for changed scope, spending, hosting/publishing, or an actual unresolved dependency; do not ask again for routine choices already covered by the handoff.

## Code and persistence conventions

- Python: snake_case functions/modules, PascalCase classes, explicit service-boundary type hints. Rust: standard formatting and explicit contract error variants. Browser code: TypeScript with typed transaction responses. Follow existing style once implementation exists.
- Keep business mutations in the proposed `evidence.py`, `reviews.py`, and `chain.py` boundaries; views validate requests and call them. Do not build a generic repository/service framework.
- Amounts are integer base units. HTTP uses decimal strings for money, chain versions, and ledger timestamps. UTC is stored; user-visible dates label their timezone. Database enums mirror documented states exactly.
- Use database constraints for uniqueness/positive revisions; validate cross-record role rules in the transaction creating the award. Short row locks protect writes; release them before RPC.
- Immutable signed evidence gets a new version on correction. Confirmed audit events are append-only through app interfaces. Database/operator access can still alter records; do not call them cryptographically tamper-proof.
- Migrations are reviewed with code. Never drop funded awards or reinterpret missing state as a new award. Backup and restore before any destructive migration; do not hide destructive work in setup scripts.

## Trust boundaries

Every endpoint MUST enforce authentication, object access, role, action allowlist, and payload validation regardless of UI state. Use CSRF on browser writes. Return safe errors; do not expose RPC credentials, private file paths, XDR internals, or other participants' records in diagnostics.

Only users' wallets sign chain actions. The backend MUST compare the signed transaction body with the stored prepared body, verify signatures/network/source, persist its hash before submission, and reconcile unknown outcomes. Successful wallet signing or HTTP submission does not mean payment succeeded. Contract authorization and terminal/version checks remain mandatory even if the app denies the same action.

Evidence downloads MUST check the individual award and currently confirmed roles. No public media route, arbitrary URL import, or public evidence link. Use synthetic records in fixtures and screenshots. Keep secrets outside source and redact logs. A failed privacy or fund-safety test blocks merging the affected implementation.

## Dependencies and reuse

The system plan's versions are proposed baselines, not proof of compatibility or perpetual security support. Before installation/build, check version-matched vendor docs and maintained patches; record any change with exact rationale, version, lockfile, and compatibility result. Use Context7 when available; primary docs decide project-specific behavior. Do not copy an example across incompatible SDK generations.

Follow the [source map](REPOSITORY_SOURCE_MAP.md) and repository report. Install published SDKs instead of vendoring them. Record adapted source URL, commit, path, changed purpose, license, and notice in the future `THIRD_PARTY_NOTICES.md`. An architecture reference is not permission to copy its assets. Resolve Hypha's frontend license ambiguity before considering code/asset adoption. Original ProofPay licensing still needs an owner decision before public release.

## Reviews, evidence, and changes

Review authorization, state boundaries, concurrent/replayed actions, irreversible changes, private storage, and unknown network outcomes. Use [VERIFICATION.md](VERIFICATION.md) as the completion ledger; no green badge or checked box without evidence.

Use [templates/CHANGE.md](templates/CHANGE.md) for a scope or design change and [templates/ADR.md](templates/ADR.md) for a durable architectural decision. Routine bug fixes that restore documented behavior do not need a new architecture approval. Changes to funds, signers, destinations, refunds, privacy, or deployment scope require an explicit user decision before that changed behavior is built.

The [operations guide](OPERATIONS.md) describes future procedures. Update commands with verified invocations during implementation. Never fabricate a setup command for a missing file.

## Agent entry formats

This repository uses Codex and Claude only. Root `AGENTS.md` is the Codex entry point; root `CLAUDE.md` directs Claude to the same rules. Launch the agent in the repository and confirm it has read those instructions. Other Markdown files are linked context, not automatically loaded rules. No agent runtime integration has been exercised here.

## Keeping documentation aligned with code

Use [OpenSpec](OPENSPEC.md) for derived task execution records. Its configuration and generated skills are subordinate to this standard and the document owners above. Validate artifacts, preserve all source-task checks, and record actual implementation evidence before synchronizing or archiving a change.

For every code change, identify and update only documents whose described behavior, interfaces, setup, or verification results actually changed. Do this in the same change and list the updated documents in the completion report. If none need updating, say why. Do not rewrite all Markdown files for routine edits, mark planned work as complete without evidence, or alter approved requirements merely to match a broken implementation. Documentation does not synchronize itself; the agent must perform and review these updates.
