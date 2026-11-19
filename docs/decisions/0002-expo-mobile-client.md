# ADR-0002: Expo mobile client for Testnet

- Status: accepted, 19 November 2026. Decisions 1 (no keys) and 4 (WalletConnect) are superseded by [ADR-0003](0003-built-in-testnet-wallet.md).
- Decision owner: the user, who approved a mobile app in this session: "it should have a testnet also in mobile apps", identifiers OK, "use my expo acc in this laptop", "do whats the best for 4"

## Context

Product scope excluded mobile apps. Recipients collect evidence in the field. The web API accepted only same-origin cookie sessions, which a native client cannot use.

## Decision

1. Add a Testnet-only Expo (React Native) app in `mobile/` that calls the existing `/api/v1` handlers. It holds no keys and signs nothing in v1. Signing actions open the web award page ("Continue on web").
2. Add cookie-less bearer auth and a mobile login mode to `web/`, behind `MOBILE_BEARER_AUTH` (see HTTP interfaces, "Mobile app access").
3. Identifiers: `com.fundora.app`, scheme `fundora`. Link the app to the user's Expo account on this machine.
4. Mobile wallet signing: Freighter Mobile documents WalletConnect v2 (`stellar:testnet`, `stellar_signXDR`). Adopting it needs a WalletConnect project ID, an on-device Testnet check and a follow-up ADR. It is **not** built in v1.

## Consequences

The server stays the only authority for roles, evidence validation and chain preparation. Store publishing, push notifications and paid EAS plans still need separate authorization. Rollback: set `MOBILE_BEARER_AUTH=0`.
