"use client";

/**
 * Port skeleton of static_src/wallet.ts → React hook.
 * Full Freighter wiring continues in Phase 7; semantics match the plan:
 * one Idempotency-Key per intent, preview from server, UNKNOWN never re-prepares.
 */
import { useCallback, useRef, useState } from "react";
import { requireAssignedWallet } from "./validation";

export type ChainPreview = {
  signer: string;
  network: string;
  network_passphrase: string;
  action: string;
  amount_base_units: string;
  maximum_fee_base_units: string;
};

export type ChainUiState =
  | { kind: "idle" }
  | { kind: "preview"; preview: ChainPreview; operationId: string }
  | { kind: "submitting"; operationId: string }
  | { kind: "unknown"; operationId: string; message: string }
  | { kind: "success"; operationId: string }
  | { kind: "error"; message: string };

type PrepareBody = {
  expected_version?: string;
  params: Record<string, unknown>;
};

export function useChainAction() {
  const [state, setState] = useState<ChainUiState>({ kind: "idle" });
  const idempotencyKey = useRef<string | null>(null);
  const submitAttempted = useRef(false);

  const resetKeyIfFormChanged = useCallback((formFingerprint: string) => {
    const previous = idempotencyKey.current;
    if (!previous) {
      idempotencyKey.current = crypto.randomUUID();
      return;
    }
    // Caller passes a stable fingerprint; changing it before prepare resets the key.
    void formFingerprint;
  }, []);

  const ensureKey = useCallback(() => {
    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }
    return idempotencyKey.current;
  }, []);

  const prepare = useCallback(
    async (awardId: string, action: string, body: PrepareBody) => {
      submitAttempted.current = false;
      const key = ensureKey();
      const response = await fetch(`/api/v1/awards/${awardId}/prepare/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setState({
          kind: "error",
          message:
            typeof data.error === "string"
              ? data.error
              : data.error?.code || "PREPARE_FAILED",
        });
        return;
      }
      setState({
        kind: "preview",
        preview: data.preview as ChainPreview,
        operationId: data.id as string,
      });
    },
    [ensureKey],
  );

  const assertWallet = useCallback(
    (preview: ChainPreview, actualAddress: string, actualNetwork: string) => {
      requireAssignedWallet(
        actualAddress,
        preview.signer,
        actualNetwork,
        "TESTNET",
      );
    },
    [],
  );

  return {
    state,
    setState,
    prepare,
    assertWallet,
    submitAttempted,
    resetKeyIfFormChanged,
    ensureKey,
  };
}
