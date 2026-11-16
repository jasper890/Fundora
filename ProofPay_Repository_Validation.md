# ProofPay: repository validation and reuse decisions

Reviewed 16 November 2026. Companion: [Product/scope](ProofPay_Product_and_Scope.md), [Implementation plan](ProofPay_System_and_Implementation_Plan.md), [Agent checklist](ProofPay_Agent_Handoff_and_InstaAward_Checklist.md).

## 1. Conclusion

**No existing application is selected as a wholesale fork.** Build a small original Django application, use published SDKs, and selectively adapt official Soroban authorization/token/test patterns. Hypha remains workflow/UI inspiration; OpenSPP is a domain comparator. The decision follows inspected code and dependency boundaries, not a preference to rewrite everything.

The user's preference to start from an existing working application was considered: Hypha provides grant application/report/invoice machinery but couples it to Wagtail, a broad project lifecycle and finance roles. Its Python resolver would install 124 packages without development groups. OpenSPP requires Odoo and a wide module graph. Neither supplies our participant-wallet claims and narrowly bounded recovery rules. For this ten-recipient demo, importing either whole application adds more integration surface than it removes. If a real pilot already uses Hypha/OpenSPP, reconsider an upstream payment adapter instead of this standalone app.

This is a source-level triage, not an exhaustive security audit or a finding of production readiness.

## 2. Reproducible source snapshots

All repositories below were shallow-cloned successfully and inspected locally. SHAs identify the reviewed default-branch snapshots, not a deployment recommendation. Link source as `https://github.com/OWNER/REPO/blob/SHA/PATH`.

| ID | Exact repository | Default branch | Reviewed commit | Commit UTC | Root license |
|---|---|---|---|---|---|
| H | [HyphaApp/hypha](https://github.com/HyphaApp/hypha) | main | `c948126be84cdb65df0bc65c55796d6c8220679b` | 2026-11-13 22:05:07 | BSD-3-Clause; see conflict below |
| O | [OpenSPP/OpenSPP2](https://github.com/OpenSPP/OpenSPP2) | 19.0 | `a71e8f04f6ecca91160afff79af868421a71b968` | 2026-10-08 05:19:29 | LGPL-3.0; modules separately declare LGPL-3 |
| A | [Aid-flow/Aidflow](https://github.com/Aid-flow/Aidflow) | main | `58075ee32de8ea2306c1c1a0c3c4841ba89519cd` | 2026-04-13 22:00:37 | MIT |
| B | [stellar-impact/aidflow](https://github.com/stellar-impact/aidflow) | main | `6e1571fa2dac05c14d6b7173bbd28e27b958bc66` | 2026-10-10 17:39:49 | Apache-2.0 |
| S | [stellar/soroban-examples](https://github.com/stellar/soroban-examples) | main | `03d42aa6b973dcf3a453a99d0c6a6e8d25a196e2` | 2026-10-06 02:12:40 | Apache-2.0 |
| J | [stellar/js-stellar-sdk](https://github.com/stellar/js-stellar-sdk) | main | `5243062fdf7a874d33cbf3089e898eb0777337a8` | 2026-11-13 23:17:41 | Apache-2.0 |
| P | [StellarCN/py-stellar-base](https://github.com/StellarCN/py-stellar-base) | main | `1b33206507bf84527214f36cba2e5849c5052fd1` | 2026-11-14 14:52:27 | Apache-2.0 |

The earlier web fetch of the JS SDK's `master/package.json` showed a different version. **Use this local main snapshot (17.4.0) for the research record**, not a claim that a cached page is the latest release. The chosen Python SDK snapshot declares 17.0.1. Never substitute default branches for these SHAs when reproducing findings.

Local review checkouts: `C:/Users/R O G - S T R I X/.codex/tmp/proofpay-review-20261116/`. These are research artifacts outside the project, not vendored dependencies. Fetch the pinned commits if that folder is unavailable. Cargo generated build artifacts/lock resolution in the research copies; source was not repaired or deployed.

## 3. Source-level findings

### H: Hypha - architecture and UI/workflow inspiration, no source copying selected

Inspected `pyproject.toml`, `package.json`, `LICENSE`, `hypha/apply/projects/models/invoice.py`, `views/invoice.py`, `permissions.py`, `reports/models.py`, `tests/test_permissions.py`, `tests/test_files.py`, `hypha/apply/utils/storage.py`, and the invoice/report template locations.

- Invoice states include submitted, changes requested, staff/finance approved, paid and failed. The view checks object access before changes. This is a useful two-stage review model, not a contract-enforced payment system.
- `reports/models.py` separates current/draft report versions and private files. Useful evidence-revision concept; it is coupled to dynamic forms, Wagtail and grant project models.
- `InvoicePrivateMedia.test_func` scopes access to staff/finance, project owner and permitted co-applicants. The base `PrivateMediaView` explicitly supplies login only; subclasses must enforce object permissions. Copying only the base class would not secure ProofPay evidence.
- Python metadata: Hypha 6.10.0, Python >=3.12, Django 5.2.19 family, Wagtail 7.0.x; Celery/Redis and document tooling are included.
- **Licensing ambiguity:** root LICENSE and Python metadata say BSD-3-Clause, but `package.json` declares GPL-2.0. Do not copy frontend assets/build configuration until that scope is clarified. No conclusion is made that the whole repository is GPL; this inconsistency blocks automatic copying.

### O: OpenSPP - research-only domain comparator; no source copying selected

Inspected `LICENSE`, `spp_programs/__manifest__.py`, `spp_approval/__manifest__.py`, `spp_approval/models/approval_review.py`, `spp_programs/models/payment.py`, `spp_programs/security/registrant_rule.xml`.

- Programs, cycles, entitlements and approval reviews are concrete models. Approval records contain requested/reviewing users, timestamps and decisions; XML includes multi-company rules.
- The reviewed base payment model has `check_account_status()` and `send_payment()` stubs. This does not prove all other payment integrations are missing; it establishes that **this model is not a working Stellar payout adapter**.
- The payment model uses `default=str(uuid4())` for reference fields; that expression is evaluated at import, rather than being a per-record callable. Do not copy that ID pattern.
- Odoo 19 and dependencies on registry, banking, accounting, stock, GIS, CEL and job modules exceed our MVP. LGPL and individual module/dependency obligations require separate review if ever adopted.

### A: Aid-flow/Aidflow - rejected implementation

Inspected `Cargo.toml`, all distribution flow in `contracts/distribution/src/lib.rs`, related fund-pool/milestone code, `sdk/src/index.ts`, `sdk/package.json`, `tests/integration_test.rs`, `LICENSE`.

- `allocate_funds` leaves registry eligibility as a placeholder. `check_milestone_condition` returns `Ok(true)` instead of checking the milestone contract. README descriptions overstate enforcement in the reviewed source.
- `release_funds` expects this contract to have been pre-funded; the documented FundPool withdrawal connection is unfinished.
- `cancel_allocation` sets Cancelled, but `release_funds` rejects only Released, so a cancelled allocation is not excluded by that status check. Treat this as a static finding; runtime confirmation was blocked by dependency compilation.
- The integration-test file contains ignored `todo!()` scenarios and is not a complete, demonstrated end-to-end suite. SDK decoding paths also contain unfinished sections.
- SDK 21-era dependencies without a committed reproducible root lock led to a dependency compile failure in this environment. Do not copy, deploy or repair this project within ProofPay's scope.

### B: stellar-impact/aidflow - useful tested contract reference, not a ready application

Inspected `README.md`, `LICENSE`, `contracts/Cargo.toml`, `contracts/escrow/src/lib.rs`, `contracts/config/src/lib.rs`, `contracts/types/src/lib.rs`, `contracts/integration-tests/tests/config_escrow_integration.rs`, and the `clients`/`services` status documentation.

- Actual escrow code stores attestation per program/milestone, requires separate oracle/admin authorization, rejects repeat release and transfers to a configured voucher registry.
- A Config-level pause is consulted across contracts; integration tests exercise rotation and wrong-key paths. Persistent and instance TTL extension is implemented.
- `refund_unspent` is gated to Completed; the source explicitly defers funder self-reclaim on a stalled program. Pause also blocks refunds. **Do not inherit this recovery policy** for ProofPay: an unresponsive approver must not strand the demo funds beyond expiry.
- Source uses Soroban SDK 26.1.1 through its lockfile; backend services, SDK and user interfaces are planned. It does not provide an application foundation we can simply launch and rebrand.
- This is a very close conceptual comparator. Its existence defeats any claim that conditional aid with evidence commitments is unique. Neither its README nor passing tests prove a grant, a pilot or an audit. No InstaAward status was established for either A or B.

### S, P, J: ecosystem components

- Official S `timelock/src/lib.rs` and `test.rs` demonstrate token custody, signer/time checks and preventing another claim by consuming state. `auth/src/lib.rs` shows explicit address authorization. These are examples, not an approved multi-role stipend contract.
- P `stellar_sdk/soroban_server.py` implements simulation/preparation/submission/lookup; `examples/soroban_invoke_contract_function_with_tx_builder.py` shows the flow. Do not copy its example secret, deployment address or unbounded polling loop. P supplies the chosen server-side SDK.
- J `src/rpc/server.ts`, `api.ts`, `transaction.ts` and package metadata are optional cross-checks for RPC semantics; do not add a Node backend solely to use J. The chosen backend is Python.

## 4. Exact reuse map

| Repo/files | ProofPay feature | Reuse method | Required change | Obligations / validation |
|---|---|---|---|---|
| H `hypha/apply/projects/models/invoice.py`, `views/invoice.py`, `templates/application_projects/invoice_detail.html` | Review queue and readable status/action layout | UI/workflow inspiration, independently implement | Replace grant-finance lifecycle with our award states and explicit wallet signing | No assets/code selected; GPL/BSD metadata conflict unresolved; runtime untested |
| H `reports/models.py`, `hypha/apply/utils/storage.py`, `views/invoice.py:InvoicePrivateMedia` | Evidence versions and private download rules | Architecture reference | Implement award-scoped access; never assume login alone suffices | Source inspected; six-file Python syntax check includes related models/views |
| O `spp_approval/models/approval_review.py`, `spp_programs/models/payment.py` | Reviewer history and transaction reconciliation fields | Research-only comparator | Independent small models; do not copy stubs/default UUID expression | LGPL/modular license review needed before any reuse |
| A `contracts/distribution/src/lib.rs`, `tests/integration_test.rs` | Negative examples for milestone/release checks | Rejected candidate | None; write our own tests that fail on these gaps | MIT does not make the implementation safe; native build failed |
| B `contracts/escrow/src/lib.rs`, `contracts/config/src/lib.rs`, `contracts/integration-tests/tests/config_escrow_integration.rs` | Two-key release, approval binding, rotation and negative tests | Architecture/test-case reference only | No vouchers; per-award fixed payee; deadlines and expiry recovery independent of holds | Apache-2.0; 128 native tests passed, no deployment/audit |
| S `auth/src/lib.rs`, `timelock/src/lib.rs`, `timelock/src/test.rs` | Signature, SAC transfer and negative-test patterns | Selective code adaptation permitted | New constructor, evidence/state checks, roles, recovery and TTL; never deploy timelock unchanged | Preserve Apache license/notices; 6 timelock tests passed |
| P `stellar_sdk/soroban_server.py`, `stellar_sdk/transaction_envelope.py`, `examples/soroban_invoke_contract_function_with_tx_builder.py` | Build, simulate, decode, submit and reconcile | Install published `stellar-sdk==17.0.1`; example as reference only | Client-side wallet signatures; finite polling; pin correct network; preserve unknown outcomes | Apache-2.0, package smoke check; complete SDK suite not run |
| J `src/rpc/server.ts`, `src/rpc/api.ts` | Optional RPC cross-reference | Reference only | No additional runtime dependency | Apache-2.0; source/package inspected, JS suite not run |

Browser wallet candidate: `@stellar/freighter-api` 6.0.1 (npm metadata, Apache-2.0, repository `stellar/freighter`). Only wallet transaction signing is planned. Its exact API and browser/network behavior must pass a compatibility check before coding the integration; this package was not installed or runtime-tested here. It is not a whole-app foundation.

## 5. Checks actually performed

Environment: Windows, Python 3.13.15, Node 24.19.0, npm 11.17.0, Rust/Cargo 1.99.1. All checks ran against research copies, not ProofPay product code.

| Command/check | Actual outcome | Meaning / limits |
|---|---|---|
| Shallow git clone + GitHub metadata for H/O/A/B/S/J/P | Succeeded; snapshots above | Reproducible source available; not an endorsement |
| `cargo test --manifest-path contracts/Cargo.toml --locked` in B | PASS: 128 tests (10 Config + 3 types + 42 escrow + 13 integration + 28 merchant + 32 voucher), zero failures | Native tests only; no WASM build, network deploy, audit or proof of real operation |
| `cargo test --manifest-path timelock/Cargo.toml` in S | PASS: 6 tests | Native official example tests only |
| `cargo test --manifest-path Cargo.toml -p distribution` in A | FAIL before project tests: E0277 in `soroban-env-host-21.2.1`, `ChaCha20Rng`/`ed25519-dalek` CryptoRng incompatibility | Fresh dependency resolution selected incompatible dependency versions; no passing test claim; no repair attempted |
| `uv sync --dry-run --locked --no-default-groups` in H | Exit 0, resolved 242 packages; would install 124 | Resolver only; **did not install, start Hypha, migrate DB or run its tests** |
| Python `ast.parse` of H invoice model/view, permissions, report model; O approval review/payment models | PASS: 6 files parse | Syntax only; not permissions, database or behavioral validation |
| Isolated environment: install `stellar-sdk==17.0.1`, `Django==5.2.19`; assert XDR roundtrip, signature verification, int128 amount roundtrip, RPC method availability and attachment response | PASS: packages installed; smoke assertions passed | Synthetic local key only; no RPC request/transaction submitted; not an application test |

No Hypha/OpenSPP UI was launched. No vulnerability scanner or full dependency-license audit was run. Root notices and selected source headers were checked, but transitive assets/dependencies are **not collectively cleared**. A full copy requires a dependency/asset inventory; the chosen design avoids importing H/O/B/A frontend or framework dependencies. New ProofPay lockfiles and a third-party notice inventory are required in implementation Task 1.

## 6. Information the coding agent should trust

1. Product decisions: the four ProofPay handoff files, not older handovers or READMEs.
2. Contract examples: pinned S and source-grounded findings from B.
3. Python transaction API: installed P version and its [primary docs](https://stellar-sdk.readthedocs.io/) matched to that version.
4. [Stellar SAC docs](https://developers.stellar.org/docs/tokens/stellar-asset-contract), [networks](https://developers.stellar.org/docs/networks), and [smart-contract docs](https://developers.stellar.org/docs/build/smart-contracts) for current chain behavior.
5. Context7 was consulted for official Stellar and Django 5.2 documentation. Retrieved examples spanned SDK generations; pinned source/API tests take precedence over blindly copying a snippet.

Recheck compatibility and maintained patch releases at execution time. Report any necessary version change with its verification; do not silently combine SDK 21, 26 and 28 examples. API sample addresses and simulated recipient names are not production configuration.
