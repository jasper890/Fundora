"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Notice } from "./Notice";
import {
  freighterAvailable,
  freighterConnect,
  freighterSign,
} from "@/lib/wallet/freighter";
import { requireAssignedWallet } from "@/lib/wallet/validation";

type Props = {
  awardId: string;
  isSponsor: boolean;
  isRecipient: boolean;
  isVerifier: boolean;
  hasLedger: boolean;
  expectedVersion?: string;
  evidenceId?: string | null;
  assignedWallet?: string | null;
};

const ACTIONS: { action: string; label: string; when: (p: Props) => boolean }[] =
  [
    {
      action: "DEPLOY",
      label: "Review award deployment",
      when: (p) => p.isSponsor && !p.hasLedger,
    },
    {
      action: "FUND",
      label: "Prepare funding",
      when: (p) => p.isSponsor && p.hasLedger,
    },
    {
      action: "SUBMIT",
      label: "Prepare submission",
      when: (p) => p.isRecipient,
    },
    {
      action: "APPROVE",
      label: "Prepare approval",
      when: (p) => p.isVerifier,
    },
    {
      action: "PAY",
      label: "Prepare payment",
      when: (p) => p.isSponsor && p.hasLedger,
    },
  ];

export function WalletPanel(props: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [unsignedXdr, setUnsignedXdr] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState(
    "Test SDF Network ; September 2015",
  );
  const [wallet, setWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connectWallet() {
    setBusy(true);
    setMessage(null);
    try {
      const available = await freighterAvailable();
      if (!available) {
        setMessage("Freighter is not available in this browser.");
        setBusy(false);
        return;
      }
      const connected = await freighterConnect();
      if (props.assignedWallet) {
        requireAssignedWallet(
          connected.address,
          props.assignedWallet,
          connected.network.includes("Test") ||
            connected.network.includes("TESTNET")
            ? "TESTNET"
            : connected.network,
          "TESTNET",
        );
      }
      setWallet(connected.address);
      setMessage(`Connected ${connected.address.slice(0, 8)}… on Testnet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet connect failed");
    }
    setBusy(false);
  }

  async function prepare(action: string) {
    setBusy(true);
    setMessage(null);
    setPreview(null);
    setOperationId(null);
    setUnsignedXdr(null);
    const version = props.expectedVersion ?? "0";
    const params: Record<string, unknown> =
      action === "SUBMIT" ? { evidence_id: props.evidenceId } : {};
    if (action === "SUBMIT" && !props.evidenceId) {
      setBusy(false);
      setMessage("Add an evidence revision before preparing submission.");
      return;
    }
    const body =
      action === "DEPLOY" || action === "EXTEND_TTL"
        ? { params: {} }
        : { expected_version: version, params };
    const response = await fetch(
      `/api/v1/awards/${props.awardId}/prepare/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(
        typeof data.error === "string"
          ? data.error
          : data.error?.code || "Prepare failed",
      );
      return;
    }
    setPreview(data.preview ?? data);
    setOperationId(data.id ?? null);
    setUnsignedXdr(
      typeof data.unsigned_xdr === "string" ? data.unsigned_xdr : null,
    );
    if (typeof data.preview?.network_passphrase === "string") {
      setNetworkPassphrase(data.preview.network_passphrase);
    }
    setMessage(
      data.preview?.mode === "live"
        ? "Live Testnet preview ready. Connect Freighter and sign."
        : "FakeRpc preview ready. Local confirm available.",
    );
  }

  async function signAndSubmit() {
    if (!operationId || !unsignedXdr) return;
    setBusy(true);
    setMessage(null);
    try {
      let signed = unsignedXdr;
      const isLive = preview?.mode === "live";
      if (isLive) {
        let address = wallet;
        if (!address) {
          const connected = await freighterConnect();
          if (props.assignedWallet) {
            requireAssignedWallet(
              connected.address,
              props.assignedWallet,
              "TESTNET",
              "TESTNET",
            );
          }
          address = connected.address;
          setWallet(address);
        }
        signed = await freighterSign(unsignedXdr, networkPassphrase);
      } else {
        signed = unsignedXdr.startsWith("FAKE-")
          ? `SIGNED-${unsignedXdr}`
          : unsignedXdr;
      }
      const response = await fetch(`/api/v1/operations/${operationId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signed_xdr: signed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(
          typeof data.error === "string"
            ? data.error
            : data.error?.code || "Submit failed",
        );
      } else {
        setPreview(data);
        setMessage(
          data.mode === "live"
            ? `Submitted (${data.status}). Refresh status until confirmed.`
            : `Confirmed locally (${data.status}). Reload the award.`,
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign/submit failed");
    }
    setBusy(false);
  }

  async function refreshStatus() {
    if (!operationId) return;
    setBusy(true);
    const response = await fetch(`/api/v1/operations/${operationId}/status`);
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(
        typeof data.error === "string"
          ? data.error
          : data.error?.code || "Status failed",
      );
      return;
    }
    setMessage(`Status: ${data.status}`);
    setPreview(data);
  }

  async function abandon() {
    if (!operationId) return;
    setBusy(true);
    const response = await fetch(`/api/v1/operations/${operationId}/abandon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(
        typeof data.error === "string"
          ? data.error
          : data.error?.code || "Abandon failed",
      );
      return;
    }
    setMessage("Unsigned preparation abandoned.");
    setOperationId(null);
    setUnsignedXdr(null);
  }

  const available = ACTIONS.filter((item) => item.when(props));

  return (
    <div>
      <p className="lead">
        Prepare an allowed action. Your wallet signs only after a server preview.
        Testnet XLM has no real monetary value.
      </p>
      {props.assignedWallet ? (
        <p className="lead">
          Assigned signer: {props.assignedWallet.slice(0, 8)}…
          {wallet ? ` · Connected ${wallet.slice(0, 8)}…` : ""}
        </p>
      ) : null}
      <div
        className="buttons"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
      >
        <Button type="button" variant="secondary" disabled={busy} onClick={connectWallet}>
          Connect Freighter
        </Button>
        {available.map((item) => (
          <Button
            key={item.action}
            type="button"
            data-preview
            disabled={busy}
            onClick={() => prepare(item.action)}
          >
            {item.label}
          </Button>
        ))}
        <Button
          type="button"
          data-submit-local
          disabled={busy || !operationId || !unsignedXdr}
          onClick={() => signAndSubmit()}
        >
          Sign and submit
        </Button>
        <Button
          type="button"
          variant="secondary"
          data-refresh-operation
          disabled={busy || !operationId}
          onClick={() => refreshStatus()}
        >
          Refresh status
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !operationId}
          onClick={() => abandon()}
        >
          Cancel unsigned
        </Button>
      </div>
      {message ? <Notice>{message}</Notice> : null}
      {preview ? (
        <pre
          data-chain-message
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: "var(--soft)",
            borderRadius: 8,
            overflow: "auto",
            fontSize: 12,
          }}
        >
          {JSON.stringify(preview, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
