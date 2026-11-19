# fundora-signer

The phone wallet's key generation and transaction signing, written in Rust ([ADR-0003](../../../docs/decisions/0003-built-in-testnet-wallet.md)).

- `rust/` — the signer crate (`stellar-xdr`, `stellar-strkey`, `ed25519-dalek`). `sign_award_call` signs only one call to the award contract's `submit`, `approve` or `pay`, on Testnet, from the wallet, with the previewed fee (at most 10 XLM), expiring within 15 minutes, and with no other authorization. Tests: `npm run test:rust` (includes a byte-for-byte fixture from the JavaScript SDK).
- `android/` — an Expo module (`FundoraSigner`) that loads `libfundora_signer.so` over JNI. Gradle runs `cargo ndk` before each build, for `arm64-v8a` (phones) and `x86_64` (emulator).
- `index.ts` — `null` in Expo Go, on iOS and on web; the app then says the wallet needs the Android build.

The secret key is kept by `expo-secure-store` behind biometrics (`src/lib/wallet/wallet.ts`); it is passed to Rust only for the moment of signing.

## Build requirements

Rust 1.100 (`rustup`), `rustup target add aarch64-linux-android x86_64-linux-android`, `cargo install cargo-ndk --version 4.1.2 --locked`, and the Android NDK from the Android SDK. EAS Build installs these in the `eas-build-pre-install` hook (`scripts/eas-install-rust.sh`).

iOS is not built yet: it needs a Mac to compile the Rust library for iOS and a Swift wrapper.
