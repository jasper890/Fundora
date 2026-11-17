"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Notice } from "./Notice";
import { freighterAvailable, freighterConnect } from "@/lib/wallet/freighter";

export function WalletCheckClient() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setMessage(null);
    try {
      if (!(await freighterAvailable())) {
        setMessage("Freighter is not installed or not available in this browser.");
        setBusy(false);
        return;
      }
      const connected = await freighterConnect();
      const onTestnet =
        connected.network.toUpperCase().includes("TEST") ||
        connected.network.includes("Test SDF Network");
      setMessage(
        onTestnet
          ? `Connected ${connected.address} on Testnet. No transaction was prepared.`
          : `Connected ${connected.address}, but network is not Testnet (${connected.network}).`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet check failed");
    }
    setBusy(false);
  }

  return (
    <div>
      <Button type="button" disabled={busy} onClick={check}>
        {busy ? "Checking…" : "Check Freighter connection"}
      </Button>
      {message ? <Notice>{message}</Notice> : null}
    </div>
  );
}
