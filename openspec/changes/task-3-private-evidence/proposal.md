# Proposal
## Why
Task 3 needs private immutable evidence and human review before Task 4 introduces signing. This implements system-plan Task 3 and A3/A6.
## What Changes
- Add versioned private evidence, canonical commitments, scoped downloads, pending review requests and disputes.
- Add stale revision checks and styled Django screens following brand direction A.
## Capabilities
### New Capabilities
- `private-evidence`: protected evidence revisions and exact-version review intents.
### Modified Capabilities
None.
## Impact
Models/migrations, evidence.py, reviews.py, forms/views/routes/templates, CSS, settings and tests. Uses local private storage and current confirmed award membership. No chain confirmation is fabricated.
