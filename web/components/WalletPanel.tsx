"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Notice } from "./Notice";

type Props = {
  awardId: string;
  isSponsor: boolean;
  isRecipient: boolean;
  isVerifier: boolean;
  hasLedger: boolean;
  expectedVersion?: string;
  evidenceId?: string | null;
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
  const [busy, setBusy] = useState(false);

  async function prepare(action: string) {
    setBusy(true);
    setMessage(null);
    setPreview(null);
    setOperationId(null);
    setUnsignedXdr(null);
    const version = props.expectedVersion ?? "0";
    const params: Record<string, unknown> =
      action === "SUBMIT"
        ? { evidence_id: props.evidenceId }
        : {};
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
      typeof data.unsigned_xdr === "string"
        ? data.unsigned_xdr
        : `FAKE-${action}-local`,
    );
    setMessage("Preview ready. Local FakeRpc can confirm without Freighter.");
  }

  async function submitLocal() {
    if (!operationId) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/v1/operations/${operationId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signed_xdr: unsignedXdr ?? `FAKE-SIGNED-${operationId}`,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(
        typeof data.error === "string"
          ? data.error
          : data.error?.code || "Submit failed",
      );
      return;
    }
    setMessage(`Confirmed locally (${data.status}). Reload the award to see the new state.`);
    setPreview(data);
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

  const available = ACTIONS.filter((item) => item.when(props));

  return (
    <div>
      <p className="lead">
        Prepare an allowed action. Your wallet signs only after a server preview.
        Testnet XLM has no real monetary value.
      </p>
      <div className="buttons" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
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
          variant="secondary"
          data-submit-local
          disabled={busy || !operationId}
          onClick={() => submitLocal()}
        >
          Confirm locally (FakeRpc)
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
