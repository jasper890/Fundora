# Tasks

## 1. Contract test harness and red invariants

- [x] 1.1 Add the `contracts/award` package pinned to `soroban-sdk = 28.0.0`, generate the lockfile, and verify resolution with `cargo fetch --manifest-path contracts/award/Cargo.toml --locked` plus test compilation with `cargo test --manifest-path contracts/award/Cargo.toml --locked --no-run`.
- [x] 1.2 Add the test-only token and account-auth fixtures plus constructor, role, deadline-boundary, stale-version, duplicate-action, evidence-revision, hold, rotation, fixed-token/destination, refund, transfer-rollback, and missing-state tests; capture the 24-test initial red run and its expected failures in `docs/VERIFICATION.md`.

## 2. Award state and authorization

- [x] 2.1 Implement constructor validation, public state, error enum, typed storage, and version checks; pass constructor, distinct classic-account, exact amount, zero commitment, deadline-order, and missing-state tests.
- [x] 2.2 Implement cancel, submit, approve, reject, reopen, verifier replacement, and hold transitions with checked revision/version increments and history events; pass role-specific auth, exact deadline, stale-action, revision invalidation, rotation, appeal, and hold tests.
- [x] 2.3 Implement bounded instance TTL maintenance and lifetime extension; pass state-preservation and absent-state tests, and record that live archive restoration remains unverified until the planned recovery phase.

## 3. Bound token movement

- [x] 3.1 Implement one-time funding, fixed-recipient payout, and strict post-cutoff refund through the constructor-bound token; pass balance assertions for success, wrong-token isolation, holds, deadline boundaries, repeats, and atomic transfer rollback.

## 4. Verification and handoff

- [x] 4.1 Run `cargo test --manifest-path contracts/award/Cargo.toml --locked`, `cargo fmt --manifest-path contracts/award/Cargo.toml -- --check`, `cargo clippy --manifest-path contracts/award/Cargo.toml --all-targets -- -D warnings`, and the supported Stellar WASM release build; record the WASM SHA-256 and actual PASS/FAIL/NOT RUN evidence in `docs/VERIFICATION.md`.
- [x] 4.2 Review Task 2 against the source plan and A1, A2, A4-A7, A9; run strict OpenSpec validation and commit the verified local result without deploying or uploading the WASM.
