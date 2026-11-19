# ADR-0003: Built-in Testnet wallet in the phone app

- Status: accepted, 19 November 2026. Supersedes ADR-0002 decision 1 ("holds no keys and signs nothing") and decision 4 (WalletConnect).
- Decision owner: the user, who asked for "my own wallet not the freight[er]" and approved the built-in Testnet wallet ("go for this").

## Context

ADR-0002 kept every signature on the web with Freighter. Freighter Mobile over WalletConnect needed a third-party project ID and was unverified on Testnet. The user wants a wallet of their own inside the Fundora app.

The server never needed Freighter specifically: `/prepare` returns an unsigned envelope, and `/submit` accepts it signed by the wallet registered on the caller's program membership (`program_member.public_wallet`, a `G…` key).

## Decision

1. **Custody:** the phone generates an ed25519 key pair from 32 bytes of OS randomness (Rust `getrandom`). The secret is stored only in `expo-secure-store` with `requireAuthentication` (Android Keystore / iOS Keychain, `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`). Every read prompts for fingerprint or face unlock. The secret is never sent to the server, logged, copied or exported.
2. **No backup or export.** Losing the phone, deleting the wallet or re-enrolling biometrics loses it. This is acceptable only because it is Testnet (`shortcut` noted in `mobile/src/lib/wallet/wallet.ts`).
3. **The phone does not trust the server's envelope.** It signs only when all of these hold:
   - The network is Testnet.
   - The envelope is a plain transaction (not a fee bump) whose source is the wallet, and the preview names the same signer.
   - It contains exactly one `invokeHostFunction` that calls the award-contract method for the action (`submit`, `approve` or `pay`).
   - Every auth entry is source-account auth for that same contract and method, with no nested calls.
   - The fee equals the preview's and is at most 10 XLM.
   - The envelope expires within 15 minutes.

   Otherwise a compromised server could get a payment, `setOptions` or an extra contract authorization signed (`sign_award_call`, `mobile/modules/fundora-signer/rust/src/lib.rs`).
4. **Actions on the phone:** SUBMIT (recipient), APPROVE (verifier, after the review note with a source check) and PAY (sponsor). Deploy, fund, reject, reopen, holds, verifier replacement and refunds stay on the web.
5. **Funding:** the app asks Stellar's public Friendbot for free Testnet XLM to pay fees, and reads the balance from Horizon Testnet.
6. **Linking:** an administrator sets the phone's address as the member's wallet **before** the award is deployed. Contract wallets cannot change afterwards, except the verifier (replaced by the sponsor on the web).
7. **Server:** the prepare, submit and abandon routes accept the mobile bearer session, behind `MOBILE_BEARER_AUTH`. The session response includes each membership's `public_wallet` so the app can show whether it is linked. The server's checks on actor, wallet, state and envelope are unchanged.
8. **Language: Rust** (the user's decision, 19 Nov 2026). Key generation, the envelope checks and signing live in the `fundora_signer` crate (`stellar-xdr` 30, `stellar-strkey` 1.0, `ed25519-dalek` 3) in `mobile/modules/fundora-signer/`. On Android it runs through an Expo module over JNI, built by `cargo-ndk` for `arm64-v8a` and `x86_64`. A test fixture built by the website's JavaScript SDK proves both produce the same envelope bytes and hash, and the JavaScript SDK verifies a Rust signature. The app no longer depends on `@stellar/stellar-sdk`.

## Consequences

- In FakeRpc mode (local and hosted preview), the server accepts `SIGNED-<xdr>` without any key. The fingerprint check is then only in the app, so a stolen bearer token can change award rows in the database (no chain involved). This predates this ADR and affects the web cookie path the same way. Keep `MOBILE_BEARER_AUTH=0` on any shared FakeRpc deployment unless that is acceptable.
- The wallet needs a development or EAS build: Expo Go cannot load native code, so there the app says the wallet needs the Android build. iOS is not built yet; it needs a Mac to compile the Rust library and a Swift wrapper. EAS Android builds install Rust in the `eas-build-pre-install` hook (`mobile/scripts/eas-install-rust.sh`).
- The secret still passes through JavaScript for the moment of signing: SecureStore hands it to JS, and JS hands it to Rust. Moving keystore access into native code would remove that; it is not needed on Testnet.
- The wallet belongs to the phone, not the Fundora account. Signing out keeps it, so anyone who signs in on that phone can use it after biometric unlock.
- A real-envelope signature on a device still needs a live Testnet run (`docs/VERIFICATION.md`).
- Mainnet would need, at minimum, a recovery phrase or backup, a security review and a new ADR.
- Rollback: release an app build without the wallet screens. Existing awards linked to a phone address then need that address's key, which only that phone holds.
