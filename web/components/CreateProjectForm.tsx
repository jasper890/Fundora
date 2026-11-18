"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { Notice } from "./Notice";

const deadlines = [
  ["claim_deadline", "Submission deadline"],
  ["review_deadline", "Review deadline"],
  ["payout_deadline", "Payout deadline"],
] as const;

export function CreateProjectForm({ verifiers }: { verifiers: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          requirements_text: data.get("requirements_text"),
          verifier_member_id: data.get("verifier_member_id"),
          ...Object.fromEntries(deadlines.map(([name]) => [name, new Date(String(data.get(name))).toISOString()])),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message ?? "Could not create the project. Check your access and try again.");
        return;
      }
      router.push(`/programs/${result.id}`);
    } catch {
      setError("Could not confirm project creation. Check your project list before retrying.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="award-section" onSubmit={submit}>
      <Field label="Project title" name="title" required maxLength={160} />
      <div className="field">
        <label htmlFor="requirements_text">Completion requirements</label>
        <textarea id="requirements_text" name="requirements_text" required maxLength={4000} rows={4} />
      </div>
      <div className="field">
        <label htmlFor="verifier_member_id">Independent verifier</label>
        <select id="verifier_member_id" name="verifier_member_id" required>
          <option value="">Select an existing verifier</option>
          {verifiers.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      <fieldset>
        <legend>Deadlines in your device’s local time</legend>
        {deadlines.map(([name, label]) => <Field key={name} name={name} label={label} type="datetime-local" required />)}
      </fieldset>
      {error ? <div role="alert"><Notice>{error}</Notice></div> : null}
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create project"}</Button>
    </form>
  );
}
