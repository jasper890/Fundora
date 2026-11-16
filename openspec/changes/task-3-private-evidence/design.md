# Design
## Context
Task 1 supplies scoped award access. Task 2 supplies the contract. See system-plan sections 2/5 and docs/HTTP_INTERFACES.md.
## Goals / Non-Goals
Goals: bounded private immutable files, reproducible commitments, explicit stale warnings, human review. Signing/reconciliation belongs to Task 4.
## Decisions
Store EvidenceVersion with nonce and canonical manifest in PostgreSQL; EvidenceFile stores randomized private file references, size and hashes. Read and hash files again on review/download. Reject unsafe names, mismatched signatures, HTML, more than three files or five MiB per file. Serialize revision creation under the award row lock; clean files on database failure. ReviewAction is append-only through application routes and never confirms a chain decision. Submitted revision/digest/version on Award are confirmed projections populated only by Task 4; review requires an exact match. Current award verifier membership controls access, never a proposed replacement.
Use brand A paper #F6F3EC, ink #202D29, pine #245848, ochre #8B5A10; native local font fallbacks avoid new font dependencies. Reading column and paired evidence/decision panels stack below 720px. Shared navigation, visible focus and field errors accompany styling.
## Risks / Trade-offs
Basic signatures do not scan malware; synthetic local scope only. Process crashes may leave unreferenced random files; later retention tooling must reconcile storage. Native tests of rotation do not prove chain confirmation.
## Migration Plan
Add models and confirmed evidence projection fields without changing existing awards. Apply additive migrations locally, retain financial rows on rollback.
