## Context

Proposed Task 1 work only. System-plan sections 1, 2, 5 and 6 own architecture, models, routes and file layout. docs/HTTP_INTERFACES.md owns proposed payloads. docs/ENGINEERING_STANDARD.md owns procedure.

## Goals / Non-Goals

Deliver the independently checkable Task 1 baseline. Contract, evidence, reconciliation, recovery and usability remain in Tasks 2-6.

## Decisions

Use documented Django sessions, CSRF, ORM, templates and PostgreSQL with a small signing bundle. Native features avoid another framework. Implement visible_awards and require_award_role as specified; administrative status grants no payment override. Preserve documented data constraints and private storage boundaries rather than inventing a reduced contract here.

## Risks / Trade-offs

- Version and wallet compatibility remain unverified: probe and lock supported versions before declaring the baseline usable.
- Wrong token/network/code identity could misidentify awards: test rejection and record primary-source provenance.
- Future payout preparation depends on these permissions: test its boundary without claiming Task 4 is implemented.

## Migration Plan

After implementation authorization, create reviewed initial migrations against local PostgreSQL. Preserve existing documentation and research. There is no existing application data to migrate. Deployment is a separate gate.
