# ProofPay web (Next.js + Supabase)

Target runtime for ADR-0001. See `docs/implementation/NEXTJS_SUPABASE_REBUILD_PLAN.md`.

```bash
cp .env.example .env.local   # fill from `npx supabase status` at repo root
npm install
npm run test
npm run typecheck
npm run build
npm run dev
```

Contract and oracle gates still run from the repository root.
