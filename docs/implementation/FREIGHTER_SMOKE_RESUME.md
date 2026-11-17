# Freighter smoke resume (after testability hardening)

**Authorization required before sending more Testnet txs.** Local app should meet the hardening exit criteria first.

## Current smoke award

- Award: `4a79c055-b003-40d0-9d98-e43d19794e9c`
- Status after hardening kickoff: **FUNDED** (DEPLOY + FUND confirmed)
- Contract: `CC5UMIFT7BZ65CO72KACKO7NIBJTYWO552OPSLUXDPLUINGIFQVJOFSP`

## Remaining path

1. **Recipient** — `demo-recipient-02` (wallet `GD4R2…`)  
   Evidence upload → **Prepare submission** → Freighter sign → wait for confirm
2. **Verifier** — `demo-verifier`  
   Review → **Prepare approval** → Freighter sign → confirm
3. **Sponsor** — `demo-sponsor` (wallet `GC35R5…`)  
   **Prepare payment** → Freighter sign → confirm

Password: seeded local demo password (same as prior smoke).

## Tester checklist

- [ ] Smoke context strip shows username, role, next step, wallet hint
- [ ] Only one primary prepare CTA for the current state
- [ ] Reload mid-prepare still allows Sign / Refresh / Cancel
- [ ] After submit, status polls toward confirmed
- [ ] Errors show code + message (not a blank RPC label)
