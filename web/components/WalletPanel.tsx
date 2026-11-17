"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { ChainPreview } from "./ChainPreview";
import { Notice } from "./Notice";
import type { AwardStatus } from "@/lib/types";
import {
  freighterAvailable,
  freighterConnect,
  freighterSign,
} from "@/lib/wallet/freighter";
import {
  clearStoredOp,
  readStoredOp,
  TERMINAL_OP,
  writeStoredOp,
} from "@/lib/wallet/opSession";
import {
  primaryPrepareAction,
  secondaryPrepareActions,
  walletRoleFromFlags,
} from "@/lib/wallet/primaryAction";
import { requireAssignedWallet } from "@/lib/wallet/validation";

type Props = {
  awardId: string;
  awardStatus: AwardStatus;
  isSponsor: boolean;
  isRecipient: boolean;
  isVerifier: boolean;
  hasLedger: boolean;
  expectedVersion?: string;
  evidenceId?: string | null;
  assignedWallet?: string | null;
  ownHold: boolean;
  hasHold: boolean;
  verifierSyncRequired: boolean;
  claimDeadline: string;
  reviewDeadline: string;
  payoutDeadline: string;
  replacementVerifierOptions: {
    id: string;
    username: string;
    wallet: string;
  }[];
};

const deadlineFormatter = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

function formatDeadline(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : deadlineFormatter.format(date);
}

function formatApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as { code?: string; message?: string };
    if (obj.message && obj.code && obj.message !== obj.code) {
      return `${obj.code}: ${obj.message}`;
    }
    return obj.message || obj.code || fallback;
  }
  return fallback;
}

export function WalletPanel(props: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [opStatus, setOpStatus] = useState<string | null>(null);
  const [unsignedXdr, setUnsignedXdr] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState(
    "Test SDF Network ; September 2015",
  );
  const [wallet, setWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [replacementVerifierId, setReplacementVerifierId] = useState("");
  const hydrated = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const role = walletRoleFromFlags(props);
  const actionContext = {
    role,
    status: props.awardStatus,
    hasLedger: props.hasLedger,
    hasEvidence: Boolean(props.evidenceId),
    hasHold: props.hasHold,
    verifierSyncRequired: props.verifierSyncRequired,
    claimDeadline: props.claimDeadline,
    reviewDeadline: props.reviewDeadline,
    payoutDeadline: props.payoutDeadline,
  };
  const primary = primaryPrepareAction(actionContext);
  const secondary = secondaryPrepareActions({ ...actionContext, ownHold: props.ownHold });
  const prepareDisabled = busy || Boolean(operationId && !TERMINAL_OP.has(opStatus || ""));

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setPolling(false);
  }, []);

  const applyOpenOp = useCallback(
    (op: {
      id: string;
      status: string;
      unsigned_xdr?: string | null;
      preview?: Record<string, unknown> | null;
    }) => {
      setOperationId(op.id);
      setOpStatus(op.status);
      const xdr =
        typeof op.unsigned_xdr === "string" && op.unsigned_xdr
          ? op.unsigned_xdr
          : null;
      setUnsignedXdr(xdr);
      if (op.preview && typeof op.preview === "object") {
        setPreview(op.preview);
        if (typeof op.preview.network_passphrase === "string") {
          setNetworkPassphrase(op.preview.network_passphrase);
        }
      }
      writeStoredOp(props.awardId, {
        operationId: op.id,
        unsignedXdr: xdr,
        networkPassphrase:
          typeof op.preview?.network_passphrase === "string"
            ? op.preview.network_passphrase
            : null,
      });
    },
    [props.awardId],
  );

  const refreshStatus = useCallback(
    async (id?: string) => {
      const opId = id ?? operationId;
      if (!opId) return;
      setBusy(true);
      const response = await fetch(`/api/v1/operations/${opId}/status`);
      const data = await response.json().catch(() => ({}));
      setBusy(false);
      if (!response.ok) {
        setMessage(formatApiError(data, "Status failed"));
        return;
      }
      const status = String(data.status ?? "");
      setOpStatus(status);
      setPreview(data);
      setMessage(`Status: ${status}`);
      if (TERMINAL_OP.has(status)) {
        stopPolling();
        clearStoredOp(props.awardId);
        setUnsignedXdr(null);
        setOperationId(null);
        if (status === "CONFIRMED_SUCCESS") {
          setMessage(
            "Confirmed on Testnet. Reload this award to see the updated state.",
          );
        }
      }
    },
    [operationId, props.awardId, stopPolling],
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      setPolling(true);
      pollTimer.current = setInterval(() => {
        void refreshStatus(id);
      }, 2500);
    },
    [refreshStatus, stopPolling],
  );

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    let cancelled = false;

    async function hydrate() {
      const stored = readStoredOp(props.awardId);
      try {
        const response = await fetch(
          `/api/v1/awards/${props.awardId}/operations/open`,
        );
        const data = await response.json().catch(() => ({}));
        if (cancelled || !response.ok) {
          if (stored?.operationId && !cancelled) {
            setOperationId(stored.operationId);
            setUnsignedXdr(stored.unsignedXdr ?? null);
            if (stored.networkPassphrase) {
              setNetworkPassphrase(stored.networkPassphrase);
            }
            setMessage("Restored open operation from this browser session.");
          }
          return;
        }
        const op = data.operation as
          | {
              id: string;
              status: string;
              action?: string;
              unsigned_xdr?: string | null;
              preview?: Record<string, unknown> | null;
            }
          | null;
        if (!op) {
          clearStoredOp(props.awardId);
          return;
        }
        applyOpenOp({
          ...op,
          unsigned_xdr: op.unsigned_xdr || stored?.unsignedXdr || null,
        });
        setMessage(
          `Resumed ${op.action ?? "operation"} (${op.status}). Continue Sign, Refresh, or Cancel.`,
        );
        if (op.status === "SUBMITTED" || op.status === "UNKNOWN") {
          startPolling(op.id);
        }
      } catch {
        /* ignore hydrate network errors */
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [applyOpenOp, props.awardId, startPolling, stopPolling]);

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
    if (prepareDisabled) return;
    if (
      action === "REPLACE_VERIFIER" &&
      !props.replacementVerifierOptions.some((option) => option.id === replacementVerifierId)
    ) {
      setMessage("Select an active replacement verifier before preparing.");
      return;
    }
    setBusy(true);
    setMessage(null);
    setPreview(null);
    setOperationId(null);
    setOpStatus(null);
    setUnsignedXdr(null);
    stopPolling();
    clearStoredOp(props.awardId);

    const version = props.expectedVersion ?? "0";
    const params: Record<string, unknown> =
      action === "SUBMIT" ? { evidence_id: props.evidenceId }
        : action === "SET_HOLD" ? { held: !props.ownHold }
          : action === "REPLACE_VERIFIER" ? { new_verifier_member_id: replacementVerifierId }
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
    try {
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
      if (!response.ok) {
        setMessage(formatApiError(data, "Prepare failed"));
        return;
      }
      const id = typeof data.id === "string" ? data.id : null;
      const xdr =
        typeof data.unsigned_xdr === "string" ? data.unsigned_xdr : null;
      setPreview(data.preview ?? data);
      setOperationId(id);
      setOpStatus(typeof data.status === "string" ? data.status : "PREPARED");
      setUnsignedXdr(xdr);
      if (typeof data.preview?.network_passphrase === "string") {
        setNetworkPassphrase(data.preview.network_passphrase);
      }
      if (id) {
        writeStoredOp(props.awardId, {
          operationId: id,
          unsignedXdr: xdr,
          networkPassphrase:
            typeof data.preview?.network_passphrase === "string"
              ? data.preview.network_passphrase
              : null,
        });
      }
      setMessage(
        data.preview?.mode === "live"
          ? "Live Testnet preview ready. Connect Freighter and sign."
          : "FakeRpc preview ready. Local confirm available.",
      );
    } catch {
      setMessage("Preparation could not be checked. Refresh the award to find any open operation before trying again.");
    } finally {
      setBusy(false);
    }
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
        setMessage(formatApiError(data, "Submit failed"));
      } else {
        setPreview(data);
        const status = String(data.status ?? "SUBMITTED");
        setOpStatus(status);
        setUnsignedXdr(null);
        if (data.mode === "live") {
          setMessage(
            `Submitted (${status}). Checking confirmation…`,
          );
          if (status === "SUBMITTED" || status === "UNKNOWN") {
            startPolling(operationId);
          } else if (TERMINAL_OP.has(status)) {
            clearStoredOp(props.awardId);
            setOperationId(null);
            setMessage(
              `Confirmed (${status}). Reload this award to see the updated state.`,
            );
          }
        } else {
          clearStoredOp(props.awardId);
          setOperationId(null);
          setMessage(`Confirmed locally (${status}). Reload the award.`);
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign/submit failed");
    }
    setBusy(false);
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
      setMessage(formatApiError(data, "Abandon failed"));
      return;
    }
    stopPolling();
    clearStoredOp(props.awardId);
    setMessage("Unsigned preparation abandoned.");
    setOperationId(null);
    setOpStatus(null);
    setUnsignedXdr(null);
    setPreview(null);
  }

  const canSign =
    Boolean(operationId && unsignedXdr) &&
    (opStatus === "PREPARED" || opStatus === "SIGNED" || opStatus == null);
  const canAbandon =
    Boolean(operationId) &&
    (opStatus === "PREPARED" ||
      opStatus === "BUILDING" ||
      opStatus === "SIGNED" ||
      opStatus == null);

  return (
    <div className="wallet-panel">
      <p className="lead">
        Prepare the next allowed action. Your wallet signs only after a server
        preview. Testnet XLM has no real monetary value.
      </p>
      {props.assignedWallet ? (
        <p className="lead">
          Assigned signer: {props.assignedWallet.slice(0, 8)}…
          {wallet ? ` · Connected ${wallet.slice(0, 8)}…` : ""}
          {opStatus ? ` · Op ${opStatus}` : ""}
          {polling ? " · Polling…" : ""}
        </p>
      ) : null}
      <div className="wallet-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={connectWallet}
        >
          Connect Freighter
        </Button>
        {primary ? (
          <Button
            type="button"
            data-preview
            disabled={prepareDisabled}
            onClick={() => prepare(primary.action)}
          >
            {primary.label}
          </Button>
        ) : props.isRecipient &&
          (props.awardStatus === "FUNDED" || props.awardStatus === "SUBMITTED") &&
          !props.evidenceId ? (
          <p className="lead wallet-no-action">
            Upload evidence above, then return here to prepare submission.
          </p>
        ) : (
          <p className="lead wallet-no-action">
            No prepare action for your role in this award state.
          </p>
        )}
        <Button
          type="button"
          data-submit-local
          disabled={busy || !canSign}
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
          disabled={busy || !canAbandon}
          onClick={() => abandon()}
        >
          Cancel unsigned
        </Button>
      </div>
      {secondary.length ? (
        <fieldset disabled={prepareDisabled}>
          <legend>Recovery and maintenance</legend>
          <p className="lead">
            Each action opens a transaction preview before signing. Review deadline: {formatDeadline(props.reviewDeadline)};
            payout deadline: {formatDeadline(props.payoutDeadline)} (Asia/Singapore).
            Holds block approval and payment; expiry refunds remain available.
          </p>
          {secondary.some((item) => item.action === "REJECT" || item.action === "REOPEN") ? (
            <>
              <p className="lead">Record the matching decision and rationale on the evidence review page before preparing rejection or reopening.</p>
              <Link className="button quiet" href={`/awards/${props.awardId}/review`}>
                Open evidence review
              </Link>
            </>
          ) : null}
          <div className="wallet-actions">
            {secondary.filter((item) => item.action !== "REPLACE_VERIFIER").map((item) => (
              <Button key={item.action} type="button" variant="secondary" onClick={() => prepare(item.action)}>
                {item.label}
              </Button>
            ))}
          </div>
          {secondary.some((item) => item.action === "REPLACE_VERIFIER") ? (
            <div className="field">
              <label htmlFor={`replacement-verifier-${props.awardId}`}>Replacement verifier</label>
              <select id={`replacement-verifier-${props.awardId}`} value={replacementVerifierId}
                aria-describedby={`replacement-hint-${props.awardId}`}
                onChange={(event) => setReplacementVerifierId(event.target.value)}>
                <option value="">Select an active verifier</option>
                {props.replacementVerifierOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.username} — {option.wallet}</option>
                ))}
              </select>
              <small id={`replacement-hint-${props.awardId}`}>
                {props.replacementVerifierOptions.length ? "Replacement clears the previous approval and verifier hold after confirmation. Your sponsor hold stays in place." : "No other active verifier is assigned to this program."}
              </small>
              <Button type="button" variant="secondary" disabled={!props.replacementVerifierOptions.some((option) => option.id === replacementVerifierId)} onClick={() => prepare("REPLACE_VERIFIER")}>
                Prepare verifier replacement
              </Button>
            </div>
          ) : null}
        </fieldset>
      ) : null}
      {message ? <Notice>{message}</Notice> : null}
      {preview ? <ChainPreview preview={preview} /> : null}
    </div>
  );
}
