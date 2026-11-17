# Tasks

## 1. Browser test setup

- [x] 1.1 Add a pinned Playwright development dependency and update its lockfile and third-party notice; verify `uv sync --locked` and `uv pip check`.

## 2. Browser coverage and handoff record

- [x] 2.1 Add isolated Django browser tests for the three role views, anonymous/unrelated evidence denial, keyboard-only preview-to-sign focus without signing, and an UNKNOWN operation; verify `uv run python manage.py test tests.e2e.test_stipend_flow --noinput`.
- [x] 2.2 Document browser setup, synthetic walkthrough, exact results and open acceptance gates in README, `docs/DEMO_RECORD.md`, and `docs/VERIFICATION.md`; verify the documented commands and links.

## 3. Integration verification

- [x] 3.1 Run the available app, contract, wallet bundle, dependency, migration and OpenSpec checks; record each actual result and any not-run reason in `docs/VERIFICATION.md`.

## Workflow follow-up

- Obtain feedback from at least two outside usability testers and record the results; until then, Task 6 usability acceptance remains incomplete.
- Run the separately deferred Testnet award flows and capture real funded/paid/refunded transaction hashes and balance evidence only after the required distinct role wallets are available and the user elects to resume those checks.
- Run `python manage.py check --deploy` with actual staging settings when they exist; do not treat local development settings as staging evidence.
- Record a demo video only after the network-backed flow is actually completed; do not create a mock video as Testnet evidence.

## 4. Table-first Next.js workspace integration

- [x] 4.1 Integrate the sponsor register and award detail hierarchy into `web/`, using the existing role-scoped server queries, presentation helpers, and action routes. Preserve the existing recipient and verifier flows and avoid changing transaction behavior.
- [x] 4.2 Add focused presentation and browser coverage for the three sponsor views, row actions, confirmed funding summary, URL state restoration, unresolved payout after reload, held awards, and role-scoped entry points.
- [ ] 4.3 Run web tests, typecheck, build, diff checks, and the local browser walkthrough. Record actual results and remaining limits in `docs/VERIFICATION.md`.
