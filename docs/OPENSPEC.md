# OpenSpec workflow

OpenSpec 2.0.0 organizes execution of the existing six-task plan. The four handoff documents and engineering standard retain their ownership. OpenSpec proposals, designs and scenarios are derived records; resolve conflicts in the owner documents before changing behavior.

## Setup

Requires Node.js 22.12.0 or later. Setup was run with Node 24.19.0 using the pinned CLI:

```powershell
$env:OPENSPEC_TELEMETRY='0'
npx.cmd --yes @fission-ai/openspec@2.0.0 init --tools codex,claude --profile core --no-animation
```

The `.cmd` form works in Windows PowerShell without changing script execution policy. On other shells use `npx` and that shell's environment-variable syntax. The CLI is fetched through npm; it is development tooling, not an application dependency. Commit generated `.agents/skills/` and `.claude/skills/` with the configuration. Restart the agent application if new skills are not visible.

## Starting work

The user authorized implementation of the six-task plan on 16 November 2026. Task 1 is active in an isolated worktree. Read the required handoff sources, then continue `task-1-application-boundary`; its implementation checklist records verified work and open gates.

Codex can invoke `$openspec-apply-change task-1-application-boundary`; Claude can use `/openspec-apply-change task-1-application-boundary`. Plain-language requests also work. Deployment, spending, publishing, Mainnet, real funds, grant submission and outreach retain separate authorization gates.

## Continuing the six tasks

Prepare a change for the next existing task when needed. Cite source sections and A1-A10 criteria, reuse the documented design, and add concrete scenarios only for that task. Do not pre-generate a second roadmap or treat plans as implemented features. Main `openspec/specs/` remains empty until verified changes are synchronized; the first proposed scenarios live under the active change.

During implementation, keep task progress and docs/VERIFICATION.md aligned with actual evidence. Before archive, check the implementation against scenarios and every source-task check. Strict OpenSpec validation checks document structure; it does not run ProofPay tests or prove security. Do not archive incomplete work to make progress appear complete.

```powershell
$env:OPENSPEC_TELEMETRY='0'
npx.cmd --yes @fission-ai/openspec@2.0.0 validate --all --strict
npx.cmd --yes @fission-ai/openspec@2.0.0 status --change task-1-application-boundary
```

Task 2 covers contract invariants; Task 3 private evidence; Task 4 signing and reconciliation; Task 5 recovery and audit; Task 6 usability and handoff. Their detailed requirements remain in the system plan. Future CLI upgrades must be deliberate and generated guidance reviewed against project rules.

Sources: [official setup](https://openspec.dev/docs/setup), [OpenSpec repository](https://github.com/Fission-AI/OpenSpec).

## Integration evidence

At initialization on 16 November 2026, OpenSpec 2.0.0 setup for Codex and Claude completed, strict validation reported 1 passed and 0 failed, and status reported all four Task 1 planning artifacts present. At that point, all eight implementation items were unchecked and no ProofPay application tests had run.

Generated workflow skills are from @fission-ai/openspec 2.0.0, upstream Fission-AI/OpenSpec. Its MIT notice is preserved in [OPENSPEC_LICENSE.txt](OPENSPEC_LICENSE.txt). On this Windows setup Claude skills are generated as separate files rather than filesystem links; retain both tool directories when copying the repository.

## Current implementation checkpoint

The Task 1 code is in `implementation/task-1-app-boundary` at the managed worktree recorded in [verification](VERIFICATION.md). Permission and login throttling tests, Django checks, migration consistency, dependency audits, and the browser bundle build are recorded there. The manual Freighter Testnet signing probe and deployment-preparation rejection checks remain open; the latter depend on the Task 2 contract and Task 4 preparation code. Do not mark Task 1 complete or archive its OpenSpec change until all source-task checks have evidence or a documented blocker/deferment.
