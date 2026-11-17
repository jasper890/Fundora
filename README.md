# ProofPay

A Stellar Testnet training-stipend prototype. A sponsor deposits funds, a recipient submits private evidence, a verifier approves it, and the sponsor separately authorizes payment. Blockchain records approvals and transfers; a human still checks the underlying completion record.

**Status (17 November 2026):** the active app is Next.js + Supabase under `web/`. Phase 10 cutover removed Django from the product path (rollback tag `django-final`; archived fixtures in `oracle/`). Hosted preview: https://proofpay-preview.vercel.app (FakeRpc). Phase 11 Freighter/Testnet A1–A10 rehearsal is in progress and still needs wallet signing at the keyboard.

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
| [Operations guide](docs/OPERATIONS.md) | Local setup and recovery procedures |
| [Synthetic demo record](docs/DEMO_RECORD.md) | Local browser setup, synthetic walkthrough and open acceptance gates |
| [UI design tooling](docs/UI_DESIGN_TOOLING.md) | DaisyUI skill, project Figma MCP, and Apple design-resource boundaries |
| [Agent handoff and award checklist](ProofPay_Agent_Handoff_and_InstaAward_Checklist.md) | Execution gates, remaining unknowns, and InstaAward preparation |
| [Decision register](docs/DECISIONS.md) | Accepted design choices and decisions still needed |
| [Phase 10/11 cutover notes](docs/implementation/PHASE10_CUTOVER_AND_PHASE11.md) | Cutover record and Freighter rehearsal checklist |

Read the product, repository report, system plan, and agent checklist in full before coding. Supporting docs explain those sources; they do not silently replace their requirements.

## Local run

1. Docker Desktop, Node 22+.
2. `npx supabase start` then copy keys into `web/.env.local` from `web/.env.example`.
3. `npm --prefix web install && npm --prefix web run dev` → http://127.0.0.1:3000
4. Contract tests: `cargo test --manifest-path contracts/award/Cargo.toml --locked`
5. App checks from `web/`: `npm run typecheck`, `npm test`, `npm run test:isolated` when needed.

## Giving this to an agent

[OpenSpec workflow](docs/OPENSPEC.md) explains the installed Codex/Claude support. Include `openspec/`, `.agents/` and `.claude/` when transferring this workflow. The existing six-task plan remains authoritative.

Use this prompt:

> Read AGENTS.md and its linked authoritative documents. Explain the selected scope and inspect the actual implementation environment. For this request, work only on the task I specify. Use the six-task implementation plan, smallest complete changes, and its required checks. Record passed, failed, and not-run results. Ask about genuine blockers; decide routine implementation details within scope. Keep private evidence and keys out of source and logs. Deployment, paid services, Mainnet, grant submission, and outreach require separate explicit authorization.

## Historical resources

The original PDF and both `ServicePass_*.md` files are background only. Django runtime lived in-tree until tag `django-final`. No public source-code license has been selected for original ProofPay work yet.
