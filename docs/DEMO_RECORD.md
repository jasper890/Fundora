# Task 6 synthetic demo and usability record

Status: local browser coverage is repeatable; outside usability sessions and the network-backed award demo have not been run. This record is not a customer pilot, Testnet proof, or funding claim.

## Run the local browser checks

On Windows PowerShell, from the repository root, with the local PostgreSQL service available:

```powershell
uv sync --locked
uv run playwright install chromium
docker compose up -d db
npm.cmd ci
npm.cmd run build
uv run python manage.py test tests.e2e.test_stipend_flow --noinput
```

The Playwright package is a development dependency. The first browser install downloads Chromium. Django creates an isolated test database; the browser tests make synthetic role accounts and keep the synthetic PDF in a temporary directory. No account credentials or evidence files are stored in the repository.

The browser suite checks the sponsor, verifier and recipient screens; anonymous and unrelated evidence-download denial; keyboard navigation from action preview through the signing control without activating signing; and the `UNKNOWN` status message after a local status refresh. Only the local prepare and status responses are intercepted. The tests do not connect a wallet, call Stellar RPC, upload a contract, sign, or submit a transaction.

## Synthetic walkthrough for outside testers

When two outside testers are available, run the local application with disposable synthetic accounts and no Testnet submission enabled. Give each tester the same task without explaining the interface first:

1. As recipient, find the award instructions, add a synthetic completion record, and identify what saving the evidence does and does not prove.
2. As verifier, find the submitted revision, identify the source that needs checking, and explain what a recorded approval request means.
3. As sponsor, locate the separate release step and explain what the UI requires before funds can be paid.
4. Use keyboard navigation to reach the action preview and signing control; stop before signing.
5. Ask the tester to explain any `Not confirmed` or `UNKNOWN` state and what they would do next.

Record completion, pauses, misunderstood labels, and the tester's own explanation in private study notes. Do not collect personal evidence, recovery phrases, private keys, or unrelated identity details. Add only de-identified usability findings here. Until two sessions are completed, the Task 6 outside-usability criterion remains incomplete.

## Deferred network evidence

The ten-recipient Testnet demonstration is intentionally deferred. Its planned sponsor, verifier and ten recipient roles require twelve distinct public G-addresses. No addresses are required for the local tests above. Do not invent contract IDs, transaction hashes, balance changes, or archive/TTL evidence; add those records only after the corresponding network operation is actually run.

The full funding, submission, independent approval, payout, duplicate rejection and held-expiry refund flow remains NOT RUN. The controlled archived-state restoration/TTL-extension check also remains NOT RUN. No demo video is included because no network-backed demo has been completed.
