"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { Notice } from "./Notice";

type Recipient = { id: string; username: string };

export function CreateAwardForm({
  programId,
  recipients,
}: {
  programId: string;
  recipients: Recipient[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/programs/${programId}/awards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_user_id: String(form.get("recipient_user_id") ?? ""),
        recipient_wallet: String(form.get("recipient_wallet") ?? "").trim(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(
        typeof data.error === "string"
          ? data.error
          : data.error?.message || data.error?.code || "Create failed",
      );
      return;
    }
    router.push(`/awards/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 480, marginTop: "1.25rem" }}>
      <div className="field">
        <label htmlFor="recipient_user_id">Recipient</label>
        <select id="recipient_user_id" name="recipient_user_id" required>
          <option value="">Select a provisioned user</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.username}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Recipient Stellar Testnet wallet"
        name="recipient_wallet"
        required
        maxLength={56}
      />
      {message ? <Notice>{message}</Notice> : null}
      <Button type="submit" disabled={pending || recipients.length === 0}>
        {pending ? "Creating…" : "Create award"}
      </Button>
    </form>
  );
}
