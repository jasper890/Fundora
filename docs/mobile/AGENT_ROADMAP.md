# Fundora mobile: agent roadmap

Status: **APPROVED 19 November 2026** ([ADR-0002](../decisions/0002-expo-mobile-client.md)). Each phase ends at a gate: stop, report evidence, and continue only when the gate passes.

## Progress (19 November 2026)

| Phase | State | Evidence / what is left |
|---|---|---|
| M0 decision | **Done** | ADR-0002; product scope §4 updated |
| M1 web API | **Done** | Bearer + mobile login + refresh + award JSON routes; web Vitest 168/168, tsc, build OK; independent review findings fixed |
| M2 scaffold | **Done** | SDK 58 app in `mobile/`; tsc, lint, jest, expo-doctor 20/20, Android bundle export OK |
| M3 auth + nav | **Done (emulator)** | Sign-in, session kept across reload, role tabs (verifier lands on Reviews). **Left:** physical device, Maestro run |
| M4 read screens | **Done (emulator)** | Awards, reviews, detail with Next step card and time left. **Left:** physical device |
| M5 camera upload | **Done (emulator)** | Camera → upload → revision 1; stored JPEG 0 EXIF tags, no GPS. **Left:** a GPS-tagged photo on a physical phone |
| M6 review / dispute | **Code done** | **Left:** run with a SUBMITTED award; confirm PENDING on web |
| M7 quality | **Mostly done** | Emulator UI/UX pass (see VERIFICATION), dark mode checked. **Left:** 200% font scale, TalkBack pass, `@expo/ui` controls |
| M8 release prep | **In progress** | EAS project linked, `eas.json`, EAS Update channel `preview`, env vars set, first preview APK built (before the UI pass; ship the fixes by rebuild or `eas update --channel preview`). **Left:** deploy the web changes with `MOBILE_BEARER_AUTH=1`, install the APK, run the device gates |
| M9 signing | Built-in wallet done (ADR-0003); emulator SUBMIT verified against FakeRpc | A live Testnet signature on a device is not run yet. WalletConnect was not pursued. |

## Rules for the agent

1. Read root `AGENTS.md`, [ENGINEERING_STANDARD.md](../ENGINEERING_STANDARD.md), and [MOBILE_APP_PLAN.md](MOBILE_APP_PLAN.md) before Phase M0. The plan is subordinate to the four authoritative handoff files.
2. **Load the named skills before writing code in a phase.** Start every Expo session with `expo-overview`, then the phase's leaf skills.
3. Detect the Expo SDK from `mobile/package.json` and read **version-pinned** docs (`docs.expo.dev/versions/vXX.0.0/…`), never `latest`.
4. Install with `npx expo install <pkg>`. Add nothing that is not in plan §8 without recording why.
5. Trust-boundary code (auth, origin, uploads) is test-first: write the failing test, show it failing, then implement.
6. Never put real wallet material, secrets, real identities, or real evidence in Git, fixtures, screenshots, or logs. Use the synthetic seed users from `web/scripts/seed.ts`.
7. Do **not**: create an Expo or EAS account, run `eas build`, `eas submit` or `eas update` against a real project, enable push, or publish anything without explicit authorization in that session.
8. Record a blocker instead of inventing a wallet integration, a test result, or a store outcome.
9. Update `docs/VERIFICATION.md` and the affected docs in the same change; list them in the completion report.
10. Track phases as an OpenSpec change (`openspec/changes/mobile-app/`) once M0 is approved; the OpenSpec tasks mirror the phases below.

## Phase map

```
M0 decision ─► M1 web API ─► M2 scaffold ─► M3 auth+nav ─► M4 read screens ─► M5 camera upload
                                                                   │
                                     M8 release prep ◄─ M7 quality ◄─ M6 review & dispute
                                                                   │
                                             M9 signing spike (parallel after M4, gated)
```

---

### M0 — Record the decision

- **Skills:** none (documentation).
- **Do:** With the user's approval, update `ProofPay_Product_and_Scope.md` §4 (move "mobile apps" from excluded to "Testnet recipient-first mobile client; no in-app keys"). Add `docs/decisions/0002-expo-mobile-client.md` from `docs/templates/ADR.md`. Record confirmed app identifiers. Create the OpenSpec change.
- **Gate:** the user's approval is quoted in the ADR; `openspec validate mobile-app` passes.

### M1 — Mobile-capable API in `web/`

- **Skills:** `superpowers:test-driven-development`.
- **Do (plan §5):** `getRequestUser(request)` in `web/lib/session.ts`; the Bearer exception in `requireSameOrigin`; `POST /api/v1/session/token` reusing `lib/auth/throttle`; `GET /api/v1/awards`, `GET /api/v1/awards/[id]`, `GET /api/v1/reviews` reusing `lib/awards` queries; the `MOBILE_BEARER_AUTH` kill switch. Switch only the routes the app calls to `getRequestUser`.
- **Tests (write first):** the six cases in plan §5, plus role scoping (recipient sees only their own awards; unrelated user gets 404).
- **Gate:** `npm run typecheck && npm run lint && npm test` in `web/` all pass; existing Playwright e2e still passes; `docs/HTTP_INTERFACES.md` documents the new routes and the bearer rule.

### M2 — Scaffold the Expo app

- **Skills:** `expo-overview` → `expo-project-structure`, `expo-design-system`.
- **Do:** from the repo root, `npx create-expo-app@latest mobile` and remove the template demo screens. Create the plan §6 folders. Set the `app.json` name, scheme `fundora`, version `0.1.0`, `runtimeVersion.policy: "fingerprint"`, and the image-picker plugin with purpose strings. Build icon and splash from `docs/brand/fundora-logo.png`. Write `src/theme.ts` from `web/app/tokens.css` (light and dark). Add `components/testnet-banner.tsx` and mount it in the root `_layout.tsx`. Write `.env.example` with `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (never the service-role key). Add `lint`, `typecheck` and `test` scripts and `jest-expo`.
- **Gate:** `npx expo-doctor` is clean; `npx tsc --noEmit`, lint and test pass; the app boots in Expo Go or a simulator showing the banner. Record the SDK version.

### M3 — Auth and navigation

- **Skills:** `expo-router`, `expo-ui`, `expo-native-ui`, `expo-data-fetching`.
- **Do:** `lib/auth/session.ts` (encrypted session storage, plan §6.1); `sign-in.tsx` → `/session/token` → `supabase.auth.setSession`; the `password-change.tsx` flow when `must_change_password`; `(app)/_layout.tsx` guarded with `Stack.Protected`; role-based tabs from `GET /api/v1/session` memberships; `lib/api/client.ts` with Bearer, error parsing, and 401 → sign-in; biometric relock (F2); sign-out clears the session, query cache and drafts.
- **Tests:** API client error parsing; a guard redirect test.
- **Gate:** Maestro `sign-in.yaml` passes for the seeded recipient, verifier and sponsor, and each sees only their own tabs; a wrong password shows the throttle-safe message.

### M4 — Read screens

- **Skills:** `expo-native-ui`, `expo-ui`, `expo-data-fetching`.
- **Do:** F4 My awards, F5 Award detail with timeline, F7 Evidence history, F12 Programs, F13 Operation status, F14 "Continue on web" (`expo-web-browser`), F16 deep links. Add `lib/format/amount.ts` (BigInt) and `components/status-pill.tsx` mapping the documented status enum, with unknown values shown as "Unknown — refresh". Every screen has loading, empty, error and offline states.
- **Tests:** `amount.test.ts` (200000000 → "20 Testnet XLM", 1 → "0.0000001", rejects non-digits); status mapping.
- **Gate:** Maestro opens an award from a `fundora://awards/<id>` link; a recipient cannot open another recipient's award (the API returns 404 and the app shows not-found).

### M5 — Camera upload (headline feature)

- **Skills:** `expo-native-ui`, `expo-ui`, `expo-animation` (progress and press feedback only), `superpowers:test-driven-development`.
- **Do:** implement plan §4 exactly: the three sources, `prepare-file.ts` (HEIC→JPEG, resize, EXIF strip, size and magic checks, safe names), `upload.ts` state machine (begin → signed upload → finalize, DELETE on failure, keep the draft for retry, 409 handling), and `screens/evidence-capture/` (file tray up to 3, preview, remove, explanation and source-ref fields with counters, progress, the "draft until signed" notice). Handle denied permissions with "Open Settings".
- **Tests (first):** `prepare-file.test.ts` (oversize → second pass → refuse; non-PDF refused; names sanitized; output starts with `ffd8ff`); `upload.test.ts` with a mocked fetch (happy path, failure after begin triggers DELETE, 409 keeps the draft).
- **Gate:** on a **physical device** (the camera does not work in simulators): take a photo → upload → the new revision appears in history and in the web app. Download the file from the web and confirm it has **no GPS EXIF** (`exiftool` shows none). Maestro `camera-upload.yaml` passes using the library-pick path.

### M6 — Review and dispute (off-chain writes)

- **Skills:** `expo-ui` (sheets, form fields), `expo-native-ui`.
- **Do:** F8 evidence viewer (memory-only image cache; PDF through the system viewer), F9 Review queue, F10 Request changes sheet → existing `/awards/[id]/review` with the request-changes action, F11 Dispute sheet. Show the server's 409 and 400 field errors inline and preserve entered text.
- **Gate:** the verifier's request-changes appears on the web award page as PENDING; the recipient's dispute is recorded and sets **no** on-chain hold; an unrelated user cannot download the evidence (A3).

### M7 — Quality pass

- **Skills:** `expo-design-system` (drift audit), `design:accessibility-review`, `expo-animation`.
- **Do:** F15 local reminders, F17 app-switcher privacy, F18 accessibility (labels, 200% font scale, contrast, reduced motion), dark mode check, haptics on result only. Audit for hardcoded colors and spacing. Confirm no evidence or PII reaches logs.
- **Gate:** an accessibility review with zero blocking findings; reminders fire from a test deadline; screenshots of every screen in light and dark using synthetic data only.

### M8 — Release preparation (stops before anything external)

- **Skills:** `eas-app-stores`, `expo-dev-client`, `eas-update`, `eas-workflows`.
- **Do locally:** write `eas.json` (development, preview and production profiles; `appVersionSource: "remote"`; `autoIncrement` on production; channels), the EAS Workflow YAML for lint, test and preview builds (`npx eas-cli workflow:validate` if available offline), and the release notes template. Document the version rules from plan §9 in `docs/OPERATIONS.md`.
- **Gate — ask the user:** an Expo account, `eas init`, the first internal preview build, and any EAS Update publish each need explicit authorization. Store submission is **out of scope** without its own decision.

### M9 — Mobile signing spike (gated, parallel after M4)

- **Skills:** `dapp`, `standards` (SEP-7), `expo-dev-client`.
- **Do:** a time-boxed spike on a branch: try plan §7 options B and C against Stellar **Testnet** with one seeded recipient SUBMIT. Verify against the wallet vendors' primary docs. Measure whether the signed XDR passes the existing `/operations/{id}/submit` checks unchanged.
- **Gate:** write the ADR with evidence (works / fails / blocked, and why). Building F19 needs a user decision on signers. Outcome: the user chose a built-in Testnet wallet instead (ADR-0003); "Continue on the web" remains for web-only actions.

---

## Completion report format (every phase)

```
Phase: M<n> — <name>
Changed: <files>
Checks: <command> → <PASS/FAIL/NOT RUN + reason>
Evidence: <screenshots / Maestro output / test names>
Docs updated: <list, or "none because …">
Blockers / decisions needed: <list>
Next: M<n+1>
```
