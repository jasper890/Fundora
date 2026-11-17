"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { Notice } from "./Notice";

export function AdminMemberForm({
  programId,
  users,
}: {
  programId: string;
  users: { id: string; username: string }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/admin/programs/${programId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: String(form.get("user_id") ?? ""),
        role: String(form.get("role") ?? "RECIPIENT"),
        public_wallet: String(form.get("public_wallet") ?? "").trim(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(
        typeof data.error === "string"
          ? data.error
          : data.error?.code || "Could not save member",
      );
      return;
    }
    setMessage(`Saved ${data.role} membership.`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: "1.5rem", maxWidth: 480 }}>
      <h2 style={{ fontSize: "1.05rem" }}>Add or update member</h2>
      <div className="field">
        <label htmlFor="user_id">User</label>
        <select id="user_id" name="user_id" required>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="role">Role</label>
        <select id="role" name="role" defaultValue="RECIPIENT">
          <option value="SPONSOR">SPONSOR</option>
          <option value="VERIFIER">VERIFIER</option>
          <option value="RECIPIENT">RECIPIENT</option>
        </select>
      </div>
      <Field label="Public wallet" name="public_wallet" required maxLength={56} />
      {message ? <Notice>{message}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save member"}
      </Button>
    </form>
  );
}
