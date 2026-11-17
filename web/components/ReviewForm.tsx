"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { Notice } from "./Notice";

export function ReviewForm({
  awardId,
  evidenceId,
  expectedVersion,
}: {
  awardId: string;
  evidenceId: string | null;
  expectedVersion: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!evidenceId) {
      setMessage("No evidence revision is available to review yet.");
      return;
    }
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/awards/${awardId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evidence_id: evidenceId,
        action: String(form.get("action") ?? "APPROVE"),
        rationale: String(form.get("rationale") ?? ""),
        source_check_method: String(form.get("source_check_method") ?? ""),
        source_confirmed: form.get("source_confirmed") === "on",
        expected_version: expectedVersion,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(
        typeof data.error === "string"
          ? data.error
          : data.error?.message || data.error?.code || "Review failed",
      );
      return;
    }
    setMessage(`Review ${data.action} recorded (${data.status}).`);
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: "1.25rem", maxWidth: 480 }}>
      <div className="field">
        <label>
          <input type="checkbox" name="source_confirmed" /> Original source
          checked
        </label>
      </div>
      <Field
        label="How you checked the source"
        name="source_check_method"
        maxLength={512}
      />
      <Field label="Action to review" name="action" defaultValue="APPROVE" />
      <Field label="Rationale" name="rationale" required maxLength={2000} />
      {message ? <Notice>{message}</Notice> : null}
      <Button type="submit" disabled={pending || !evidenceId}>
        {pending ? "Saving…" : "Request a review"}
      </Button>
    </form>
  );
}
