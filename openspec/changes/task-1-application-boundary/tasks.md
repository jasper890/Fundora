## 1. Task 1 baseline

Source: [system-plan Task 1](../../../ProofPay_System_and_Implementation_Plan.md). All work is proposed and NOT RUN. Implementation requires a subsequent user request.

- [ ] 1.1 Inspect the implementation workspace and version-matched primary documentation; record exact tool versions and location, preserving existing files.
- [ ] 1.2 Write Task 1 permission tests for anonymous redirects, unrelated-participant 404, administrator payout denial and repeated role user/address rejection; run python manage.py test proofpay.tests.test_permissions and record expected initial failures.
- [ ] 1.3 Create documented project configuration, models/migrations, visible_awards, require_award_role, provisioned login and private storage using native sessions/CSRF/templates; verify permission tests against PostgreSQL.
- [ ] 1.4 Lock compatible maintained dependencies, inventory licenses including the browser bundle, preserve adapted-source notices and record versions; inspect install/audit results and resolve critical exposed issues.
- [ ] 1.5 Probe Freighter 6.0.1 signing on Testnet with a user-controlled throwaway wallet; record success or a compatible replacement/blocker without server-held keys. Obtain deployment authorization before deploying anything.
- [ ] 1.6 Test that deployment preparation rejects wrong token, network and code hash; document verified native Testnet SAC provenance without inventing IDs.
- [ ] 1.7 Run permission tests, python manage.py check, migration consistency check and frontend build; record PASS/FAIL/NOT RUN and exact commands in docs/VERIFICATION.md and document verified setup.
- [ ] 1.8 Review against every source Task 1 requirement and commit the independently testable baseline; leave acceptance criteria incomplete where later tasks are needed.
