# Cursor continuation — 17 November 2026 (updated)

## Resume context

- Workspace: `C:\Users\R O G - S T R I X\Desktop\Proofpay-next`
- Branch: `feature/resume-local-hardening` (also pushed to `dev`)
- Latest checkpoint: `6df4c81` — proxy migration + gated hosted seed
- Preview live: https://proofpay-preview.vercel.app (FakeRpc on, submissions off)

Read `AGENTS.md`, `README.md`, `docs/ENGINEERING_STANDARD.md`, the four authoritative handoffs, and [PHASE9_PREVIEW_AND_CUTOVER.md](PHASE9_PREVIEW_AND_CUTOVER.md) before changing behavior.

## Status

| Area | State |
|---|---|
| Local FakeRpc hardening + isolated suite | Green (prior commits) |
| Live unlock blockers | Closed in `baacba3` |
| Production build | Passed |
| Phase 9 preview + hosted seed | Live; seed done |
| Freighter live smoke | Needs user at keyboard |
| Phase 10 Django cutover | Not started — wait for preview acceptance |
| Phase 11 A1–A10 | Gated on Freighter evidence |

## Next actions

1. Spot-check preview doors with demo users (password from local seed env only).
2. Freighter smoke when ready — [FREIGHTER_SMOKE_RESUME.md](FREIGHTER_SMOKE_RESUME.md).
3. After preview acceptance, Phase 10 cutover prep only with explicit OK.
4. Rotate Supabase DB password if the URI was pasted in chat; refresh Vercel `DATABASE_URL`.
