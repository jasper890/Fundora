# Stale runtime notes (Django-era)

These supporting docs still contain useful product/design context but their **runtime assumptions are superseded** by [ADR-0001](decisions/0001-nextjs-supabase-runtime.md):

| Doc | What is stale |
|---|---|
| Older lines in `ENGINEERING_STANDARD.md` preferring Django auth/ORM/templates | Prefer Next route handlers + SQL + Supabase Auth for new work |
| `BRAND_EXPLORATION.md` “do not introduce a frontend framework” | UI is Next.js App Router |
| Django-only run snippets in older verification appendices | Use `web/` + Supabase local; Django product path removed in Phase 10 (`django-final` / `oracle/`) |
| `ui-mock/` simulation architecture | Design reference only; not production data |

Do **not** delete the four authority `ProofPay_*.md` files. Update them only through ADR-amended ownership when product/contract meaning changes.
