## 1. Task 1 baseline

Source: [system-plan Task 1](../../../ProofPay_System_and_Implementation_Plan.md). Implementation was authorized on 16 November 2026. Task evidence is recorded in [verification](../../../../docs/VERIFICATION.md); unchecked items remain open.

- [x] 1.1 Inspect the implementation workspace and version-matched primary documentation; record exact tool versions and location, preserving existing files.
- [x] 1.2 Write Task 1 permission tests for anonymous redirects, unrelated-participant 404, administrator payout denial and repeated role user/address rejection; run `python manage.py test proofpay.tests.test_permissions` and record expected initial failures.
- [ ] 1.3 Create documented project configuration, models/migrations, visible_awards, require_award_role, provisioned login and private storage using native sessions/CSRF/templates; verify permission tests against PostgreSQL. Django config, role models, scoped queries, login and tests are in place; private evidence storage/download and its access tests remain Task 3 work.
- [x] 1.4 Lock compatible maintained dependencies, inventory licenses including the browser bundle, preserve adapted-source notices and record versions; inspect install/audit results and resolve critical exposed issues.
- [ ] 1.5 Probe Freighter 6.0.1 signing on Testnet with a user-controlled throwaway wallet; record success or a compatible replacement/blocker without server-held keys. The extension was not found in the checked browser profiles; no signing request or server-held key was used. Deployment remains separately authorized.
- [ ] 1.6 Test that deployment preparation rejects wrong token, network and code hash; document verified native Testnet SAC provenance without inventing IDs. Deferred until the Task 2 contract/code hash and Task 4 preparation boundary exist; no Testnet deployment occurred.
- [x] 1.7 Run permission tests, `python manage.py check`, migration consistency check and frontend build; record PASS/FAIL/NOT RUN and exact commands in docs/VERIFICATION.md and document verified setup.
- [x] 1.8 Review against every source Task 1 requirement and commit the independently testable baseline; leave acceptance criteria incomplete where later tasks are needed. Local baseline commit: `c70cf04`; private evidence, wallet-signing and deployment-preparation gates remain open.
