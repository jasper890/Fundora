# UI checkpoint and remaining work

Paused at the user's request. Continue in `Proofpay-next` on `feature/testability-hardening`; the unfinished implementation is checkpointed in Git.

## Saved implementation

- Forest/ivory/coral tokens, responsive shell, role doors, login layout, role-specific home presentation, shared form styling and reduced-motion rules.
- Associated Field labels/hints/errors, current navigation and Testnet context.
- WalletPanel receives hold/sync state, exact deadlines and replacement choices from award details. Primary wallet actions are gated by role, state, deadlines, holds and evidence availability; updated helper tests pass.
- Backend additions include scoped program detail, evidence history/download links, password change, and account provisioning. These need actual-screen integration review.

## Explicitly unfinished

- No independent review of rendered screens has been completed. Static source review is not visual acceptance.
- Secondary wallet controls are not completed: cancellation, refund, own-role hold, reject/reopen, verifier replacement and TTL need real user-facing controls and matching backend verification. Passing unused replacement props is not a working rotation flow.
- Run and fix the new account, authorization, lifecycle and responsive Playwright tests. No successful final E2E result or production build is recorded for this checkpoint.
- Inspect 320/390/820/1440 widths, keyboard-only flows, focus, contrast, touch targets, loading/empty/error/disabled states, long content, and reduced motion. Check every role and the evidence, password, account, review, audit, admin and signing screens.
- Review CSS for duplicate/obsolete rules after the visual pass; do not claim a maintainable final design system solely from screenshots.

Use `npm run test:isolated -- --serve` for a fresh local synthetic review instance. Do not run browser tests against the interactive demo database or Freighter profile. Have the independent UI reviewer report findings, let the frontend implementer fix them, and independently recheck before closing the UI gate.

Final integrated checkpoint: TypeScript passed, quiet lint passed, and 73 unit tests passed across 18 files. Browser and visual gates remain NOT RUN.
