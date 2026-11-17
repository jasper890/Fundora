"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";

export function LoginForm({ door }: { door: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    void door;
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = {
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const response = await fetch("/api/v1/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: { message?: string } | string;
      password_change_required?: boolean;
    };
    setPending(false);
    if (!response.ok) {
      const message =
        typeof data.error === "string"
          ? data.error
          : data.error?.message || "Invalid username or password.";
      setError(message);
      return;
    }
    router.replace(data.password_change_required ? "/password-change" : "/programs");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field label="Username" name="username" autoComplete="username" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {error ? <p className="notice">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
