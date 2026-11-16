# Design

## Context

See proposal.md. The application is Django with a PostgreSQL test setup. Before this change, its Python dependencies had no browser automation; Playwright is now a development-only dependency. The browser bundle has only TypeScript/esbuild development tools. Existing app tests already cover role permissions, evidence download controls, and unknown chain outcomes, but they do not exercise those states in a browser.

## Goals / Non-Goals

**Goals:**

- Run browser tests against Django's isolated `StaticLiveServerTestCase` and synthetic database fixtures; the test server serves assets found by Django's staticfiles finders.
- Keep evidence files in a temporary test directory and use private synthetic session cookies created in the test process.
- Stub only the browser's prepare/status HTTP responses needed to exercise the UI. Never contact Stellar RPC, connect a wallet, sign, or submit.
- Make the browser suite runnable with the repository's Python environment and a documented Chromium install command.

**Non-Goals:**

- Simulating or claiming live Testnet deployment, transaction, or archive evidence.
- Adding product routes, changing role rules, or altering persisted business state.
- Treating automated browser checks as a substitute for two outside usability testers.

## Decisions

- Add pinned Playwright Python as a development dependency and use Django `StaticLiveServerTestCase`. This makes the planned browser checks repeatable without using the persistent preview database and serves the static bundle through Django's normal staticfiles finders. A one-off external browser session was considered but would leave teammates without a runnable test.
- Reuse the existing `create_award` and `store_evidence` paths with labeled synthetic records; override the private evidence root to a temporary directory. Do not embed login credentials or wallet keys.
- Use Playwright's async API inside `asyncio.run` after Django fixtures are created. The sync Playwright API runs an event loop in the Django test thread and triggers Django's async-safety guard during ORM setup.
- Test keyboard access by tabbing to the prepare control, activating it with Enter against a stub response, and asserting focus moves to the signing control. Do not activate signing.
- Test the unknown-result message by stubbing the status response to `UNKNOWN`; assert the app keeps the action unconfirmed and does not show payment success.

## Risks / Trade-offs

- A browser binary must be installed once with `uv run playwright install chromium`; the Python package alone is insufficient. Record the exact setup and command.
- The Testnet and outside-tester acceptance gates remain incomplete; local mocks and fixtures do not satisfy them.

## Migration Plan

No database or deployment migration. Add the development dependency and lockfile entry, add `tests/e2e/test_stipend_flow.py`, then run the targeted browser suite and full app/contract regression. Rollback is limited to removing the test file and development dependency if it proves incompatible.
