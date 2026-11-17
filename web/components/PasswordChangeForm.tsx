"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { Field } from "./Field";

export function PasswordChangeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/session/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: String(form.get("current_password") ?? ""),
        new_password: String(form.get("new_password") ?? ""),
        confirm_password: String(form.get("confirm_password") ?? ""),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: { message?: string } | string;
    };
    setPending(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : data.error?.message || "Password update failed.");
      return;
    }
    router.replace("/programs");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field label="Current password" name="current_password" type="password" autoComplete="current-password" required />
      <Field label="New password" name="new_password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
      <Field label="Confirm new password" name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
      {error ? <p className="notice" role="alert">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Updating…" : "Change password"}</Button>
    </form>
  );
}
