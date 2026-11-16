# Verification and completion evidence

Status: future targets; every ProofPay check below is NOT RUN. Historical upstream example results in the [repository report](../ProofPay_Repository_Validation.md) are not ProofPay test results. Run commands only after their files/dependencies exist. The [system plan](../ProofPay_System_and_Implementation_Plan.md) contains detailed failing-test steps.

| Scope criterion | Owner task | Minimum proof | Planned checks |
|---|---|---|---|
| A1: fixed synthetic program and distinct roles | 1, 2, 5 | Ten synthetic recipients; equality of role users/wallets rejected; all amounts 200000000 | `test_permissions`; contract constructor tests; seed verification |
| A2: funding actually confirmed | 2, 4, 5 | Exact sponsor/contract token balance change and expected state | Contract fund tests and independent Testnet read/hash |
| A3: evidence privacy | 3 | Anonymous/unrelated/old verifier download denied; authorized access succeeds | `test_evidence`, `test_permissions` |
| A4: approve then pay once | 2, 4, 5 | Current verifier approval, sponsor signature, immutable recipient balance increases once | Contract authorization/balance tests and demo transaction records |
| A5: invalid payout blocked | 2, 4 | Wrong signer, missing approval, hold, deadline, duplicate and redirect attempts move no funds | Contract negative tests; signed-body mutation tests |
| A6: stale evidence/rotation invalidated | 2, 3, 4 | Old version rejected; confirmed rotation removes old access; unknown rotation grants none | Named rotation/revision tests and app access tests |
| A7: expiry recovery | 2, 5 | Every funded unpaid state refunds after cutoff despite holds/missing verifier | Boundary/hold tests; separate expiry Testnet award |
| A8: unknown outcomes never duplicate | 4, 6 | Timeout stays unknown; concurrent workers/idempotent retries settle once | `test_chain`, browser unknown-state scenario |
| A9: rollback/restart recovery | 2, 4, 5 | Failed token transfer rolls back; restart rebuilds chain snapshots | `test_recovery`, contract rollback tests |
| A10: reproducible demo and truthful labels | 5, 6 | Setup followed from clean environment; Testnet/synthetic visible; checks and limits recorded | Browser walkthrough; demo record; setup reproduction |

## Proposed commands

```text
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test proofpay.tests
cargo test --manifest-path contracts/award/Cargo.toml --locked
cargo fmt --manifest-path contracts/award/Cargo.toml -- --check
cargo clippy --manifest-path contracts/award/Cargo.toml --all-targets -- -D warnings
npm ci
npm run build
```

Task 1 must create the package build script and lockfiles before those commands can be used. Use current supported Soroban WASM target/toolchain and record exact release-build invocation/hash after compatibility checking; no unverified build command is invented here. Browser test runner and command are selected/recorded when `tests/e2e/test_stipend_flow.py` is created. Staging checks include `python manage.py check --deploy` with actual staging settings; local development warnings cannot be represented as a secure hosted deployment.

Contract tests must pin exact cutoff equality (`<=` for claim/review/pay and `>` for refund), every mutator's signer and stale version, state transitions, hold ownership, rotation, transfer rollback, TTL and archival interpretation. At least some tests assert specific expected authorization, rather than letting `mock_all_auths` mask missing checks. App tests cover CSRF, object scope, immutable evidence, corrupted/mismatched uploads, signed-body mutations, sequence contention, concurrent reconciliation, and storage retention.

Manual wallet checks cover rejection, wrong account/network, explicit preview, keyboard focus, stale tab, disconnect, and refresh while unknown. Mark manual checks separately from automated checks. Mocked expiry/archive/reset checks are not live network evidence. Public Testnet reset cannot be triggered merely to complete a test.

## Completion record format

For each task record: commit or working snapshot, requirement IDs, environment/tool versions, exact command/manual procedure, date, exit/result, counts, evidence reference, limitations, and remaining failure. Status is PASSED, FAILED, BLOCKED, or NOT RUN. Store only sanitized screenshots and chain hashes; no passwords, real evidence, or signing material. A skipped check stays incomplete.

Independent usability testers and customer interviews are separate evidence categories. No outside testers exist by assumption. A successful synthetic technical demo does not establish demand, grant eligibility, audit, or production readiness.
