# Design decisions and remaining gaps

Status: accepted design direction from the existing handoff, not implementation verification. Date: 16 November 2026.

| Decision | Reason and tradeoff | Owner |
|---|---|---|
| ~~Original small Django application~~ → **Next.js + Supabase runtime** | Free no-VM hosting for personal POC/MVP; Django retained as behaviour oracle until cutover. See [ADR-0001](decisions/0001-nextjs-supabase-runtime.md) | Owner + ADR-0001 (17 Nov 2026) |
| ~~Server-rendered pages with small signing bundle~~ → **Next.js App Router UI + route handlers** | Same product rules; Freighter/Varial still signs in the browser. Superseded by [ADR-0001](decisions/0001-nextjs-supabase-runtime.md) | Owner + ADR-0001 (17 Nov 2026) |
| Per-award immutable contract, fixed recipient and amount | Isolates ten recipients and limits redirection; multiple contract deployments | System plan |
| Native Testnet XLM SAC | Avoids issuer/trustline dependency for synthetic demo; no stablecoin/fiat value claim | Product scope |
| Recipient submit, verifier approve, sponsor release | Explicit independent responsibilities; still depends on honest humans and uncompromised keys | Product/system plan |
| Private evidence with public commitment | Avoids public records and binds exact version; hash does not prove truth and chain metadata remains visible | Product/system plan |
| Expiry refund independent of holds | Missing verifier cannot strand unpaid deposit indefinitely; recipient cannot compel an approved sponsor payment | System plan |
| No AI in MVP | Human verification and fund safety must work first; optional AI offers no automatic trust guarantee | Product scope |
| One standard, short tool adapters | Keeps cross-agent rules consistent; actual context loading depends on tool/version | Engineering standard |

## Decisions needing the user's input

| Gap | When it blocks progress | Default meanwhile |
|---|---|---|
| Implementation authorization/destination | Starting code | This phase produces documentation only; inspect any future destination first |
| Team capacity, budget and timeline | Sprint/award commitment | Treat 30 days as an assumption, not a delivery promise |
| Original source-code license | Publishing original code for reuse | No LICENSE is invented; select license before public code release |
| Hosting/provider/spending | Hosted demo | **Partial settle (17 Nov 2026):** Vercel Hobby + Supabase Free for personal POC/MVP; deploy still needs separate authorization. No paid accounts authorized. See [ADR-0001](decisions/0001-nextjs-supabase-runtime.md) and [rebuild plan](implementation/NEXTJS_SUPABASE_REBUILD_PLAN.md) |
| Chapter and eligibility confirmation | Grant submission | Existing checklist, no acceptance or eligibility promise |
| Real program organizer and demand | Pilot/business claims | Synthetic workshop and honest user discovery |
| Real assets, users, Mainnet and custody/recovery policy | Any real-money expansion | Outside current MVP; new design and review |

## Technical gates the agent should resolve with evidence

These need investigation, not repeated permission for routine decisions: wallet/API compatibility; supported dependency patches and exact lockfiles; native Testnet SAC and allowed WASM hash; current TTL/archival tooling; full dependency/asset notice inventory; proxy/upload limits; accessibility; source-account sequence contention. Record results in the implementation task and verification ledger. Escalate only if resolving a gate changes approved behavior, cost, privacy, or authority.

The original four handoff sources remain intact. New HTTP payload details are proposed implementation conventions. If implementation reveals a contradiction with contract rules, resolve the owner document and tests rather than patching around it. Track durable changes with the [ADR template](templates/ADR.md).
