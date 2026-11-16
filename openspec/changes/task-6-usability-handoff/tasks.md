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
