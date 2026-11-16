# ProofPay

Documentation for a proposed Stellar Testnet training-stipend prototype. A sponsor deposits funds, a recipient submits private evidence, a verifier approves it, and the sponsor separately authorizes payment. Blockchain records approvals and transfers; a human still checks the underlying completion record.

**Status: Task 1 implementation in progress, 16 November 2026.** This repository now has a local Django/PostgreSQL baseline, role-scoped award access, provisioned login, locked dependencies, and a Freighter API browser bundle. The Soroban contract, evidence workflow, chain actions, and Testnet deployment are not implemented. No customer pilot or production readiness is claimed. Research checks in the repository report are checks of upstream projects, not ProofPay tests.

## Start here

| Read | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Entry instructions for a coding agent |
| [Engineering standard](docs/ENGINEERING_STANDARD.md) | Shared development rules and document authority |
| [Product and scope](ProofPay_Product_and_Scope.md) | Users, boundaries, and acceptance criteria A1–A10 |
| [System and implementation plan](ProofPay_System_and_Implementation_Plan.md) | Detailed architecture, database, contract ABI, screens, and six implementation tasks |
| [Architecture guide](docs/ARCHITECTURE.md) | Visual explanation of the design and trust boundaries |
| [HTTP interfaces](docs/HTTP_INTERFACES.md) | Proposed request/response contracts and error handling |
| [Repository validation](ProofPay_Repository_Validation.md) | Reviewed snapshots, findings, licenses, and permitted reuse |
| [Clickable source map](docs/REPOSITORY_SOURCE_MAP.md) | Direct links to specific upstream files and their intended use |
| [Verification matrix](docs/VERIFICATION.md) | Requirements mapped to future checks and evidence |
| [Operations guide](docs/OPERATIONS.md) | Local setup boundary and proposed recovery procedures |
| [Agent handoff and award checklist](ProofPay_Agent_Handoff_and_InstaAward_Checklist.md) | Execution gates, remaining unknowns, and InstaAward preparation |
| [Decision register](docs/DECISIONS.md) | Accepted design choices and decisions still needed |

Read the product, repository report, system plan, and agent checklist in full before coding. Supporting docs explain those sources; they do not silently replace their requirements.

## Giving this to an agent

[OpenSpec workflow](docs/OPENSPEC.md) explains the installed Codex/Claude support and prepared Task 1 change. Include `openspec/`, `.agents/` and `.claude/` when transferring this workflow. The existing six-task plan remains authoritative.

Copy this root's current Markdown files and the `docs/` directory together into the GitHub repository. Include root `AGENTS.md` for Codex and `CLAUDE.md` for Claude; both point to the same standard. Preserve relative paths. Do not copy research clone caches, local credentials, evidence, or generated archives into source control.

Use this prompt:

> Read AGENTS.md and its linked authoritative documents. Explain the selected scope and inspect the actual implementation environment. For this request, work only on the task I specify. Use the six-task implementation plan, smallest complete changes, and its required checks. Record passed, failed, and not-run results. Ask about genuine blockers; decide routine implementation details within scope. Keep private evidence and keys out of source and logs. Deployment, paid services, Mainnet, grant submission, and outreach require separate explicit authorization.

The user authorized the six-task implementation on 16 November 2026. Task 1 remains in progress; see [OpenSpec](docs/OPENSPEC.md), [operations](docs/OPERATIONS.md), and [verification](docs/VERIFICATION.md) for actual state and blockers. Deployment and paid or public activity retain their separate authorization gates. If copied into another code repository, inspect and preserve that repository's code and more specific instructions before choosing the build location.

## Historical resources

The original PDF and both `ServicePass_*.md` files are background only. Their repair/warranty project and repo choices are superseded by the ProofPay scope. The old `ProofPay_Agent_Package_2026-11-16.zip` predates this expanded documentation; do not use it as the current package. No public source-code license has been selected for original ProofPay work yet.

For documentation changes, use the [change template](docs/templates/CHANGE.md). For implementation, execute the existing six tasks; do not create a second competing plan.
