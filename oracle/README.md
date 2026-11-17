# Django oracle archive (Phase 10)

Frozen **comparison fixtures** from the Django baseline. They are **not** a runnable product path.

- Tag for full rollback: `django-final` (`95c690b` at cutover).
- Active runtime: `web/` (Next.js + Supabase) + `contracts/`.
- These files preserve the golden test names and assertions used before cutover. Restoring a runnable Django stack means checking out `django-final`.

Do not add new product features here. Do not treat this directory as authorization to run Django in production.
