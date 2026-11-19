#!/usr/bin/env bash
# EAS Build images have no Rust. Android builds compile modules/fundora-signer/rust with cargo-ndk
# (see modules/fundora-signer/android/build.gradle), so install the pinned toolchain first.
set -euo pipefail
[ "${EAS_BUILD_PLATFORM:-android}" = "android" ] || exit 0
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.100.0
source "$HOME/.cargo/env"
rustup target add aarch64-linux-android x86_64-linux-android
cargo install cargo-ndk --version 4.1.2 --locked
