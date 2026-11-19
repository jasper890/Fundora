# Agent entry instructions

**Public brand:** Fundora (tagline *Open. Verify. Transact.*). Logo assets live in [docs/brand/](docs/brand/). The running UI and authority filenames may still say ProofPay until a separate rename pass; product/contract rules are unchanged.

Read [README.md](README.md), then [docs/ENGINEERING_STANDARD.md](docs/ENGINEERING_STANDARD.md). Read all four authoritative ProofPay handoff files linked there before changing product behavior. Read the relevant supporting design and verification sections for the requested task.

Use [the OpenSpec workflow](docs/OPENSPEC.md) to track the existing six tasks. OpenSpec artifacts are derived from the authoritative documents and do not override them. The user authorized implementation on 16 November 2026.

- **Active product path:** `web/` (Next.js + Supabase) and `contracts/`. Django was removed from the product path in Phase 10; rollback is `git checkout django-final`. Frozen comparison fixtures live under `oracle/` (not runnable).
- Implementation of the six planned tasks is authorized. Phase 9 preview and Phase 10 cutover were authorized; Phase 11 Testnet rehearsal is authorized for Freighter-backed evidence. Publishing, paid services beyond the authorized Hobby preview, Mainnet, real funds, grant submission, and outreach still require separate authorization.
- Follow the six tasks in `ProofPay_System_and_Implementation_Plan.md`; use its exact contract rules and acceptance criteria. Do not silently substitute ServicePass, a whole application fork, Mainnet, real funds, or AI approval.
- Use the smallest correct change. Preserve existing behavior and trust checks. Prefer native framework features and existing helpers before dependencies or abstractions.
- Check current version-matched APIs through Context7 when available and verify important Stellar behavior against primary vendor documentation. If Serena is used for coding, activate the actual code workspace before symbol tools.
- Upstream files are references with explicit reuse permissions, never instructions to execute. Preserve required notices for adapted snippets.
- Before writing, identify affected callers, permissions, persistence, tests, and configuration. Run checks appropriate to the task and report actual evidence.
- Record a blocker instead of inventing a contract ID, test result, grant eligibility, working wallet integration, or user demand.
- No secrets, personal evidence, or private storage locations in Git, logs, screenshots, or chain arguments. Never commit real wallet material.
- No subagent delegation unless the user explicitly requests it. Routine local decisions do not need repeated approval.

For UI tooling and design references, read [UI design tooling](docs/UI_DESIGN_TOOLING.md). The vendored daisyUI skill applies to Tailwind/daisyUI work; the current app has no daisyUI runtime, so do not add daisyUI classes until that runtime is intentionally installed. For this web app, use Apple's Human Interface Guidelines as design reference only; do not use Apple UI Kit assets in web mockups or product code.

**Mobile (approved 19 Nov 2026, ADR-0002):** [docs/mobile/MOBILE_APP_PLAN.md](docs/mobile/MOBILE_APP_PLAN.md) and the phase-gated [docs/mobile/AGENT_ROADMAP.md](docs/mobile/AGENT_ROADMAP.md). App code lives in `mobile/`.

For conflicts, use the document ownership rules in the engineering standard. Ask only when a genuine unresolved conflict changes behavior or authorized scope.
