"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { Notice } from "./Notice";

export function AdminUserForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function provision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), temporary_password: form.get("temporary_password") }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || data.error?.code || data.error || "Account could not be created.");
      element.reset();
      setMessage(`Account ${data.username} created. The user must change their temporary password on first sign in. Assign program access separately.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account creation failed."); }
    finally { setBusy(false); }
  }
  return <section className="award-section">
    <h2>Provision an account</h2>
    <p className="lead">Create a participant account, then assign its program role. Creating an account grants no program, evidence or payment access.</p>
    <form onSubmit={provision} aria-busy={busy}>
      <Field label="New username" name="username" autoComplete="off" required minLength={3} maxLength={64} pattern="[a-z0-9][a-z0-9._-]{2,63}" hint="3–64 lowercase letters, numbers, dots, underscores or hyphens." />
      <Field label="Temporary password" name="temporary_password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} hint="At least 12 characters, including uppercase and lowercase letters and a number. Share securely outside this app." />
      <div aria-live="polite">{message ? <Notice>{message}</Notice> : null}</div>
      <Button type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
    </form>
  </section>;
}
