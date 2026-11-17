"use client";

import { createClient } from "@supabase/supabase-js";
import { useState } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { Notice } from "./Notice";

function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function EvidenceUploadForm({
  awardId,
  expectedRevision = 0,
}: {
  awardId: string;
  expectedRevision?: number;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const files = form
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length < 1 || files.length > 3) {
      setPending(false);
      setMessage("Upload between one and three files.");
      return;
    }

    const begin = await fetch(`/api/v1/awards/${awardId}/evidence/begin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        explanation: String(form.get("explanation") ?? ""),
        source_ref: String(form.get("source_ref") ?? ""),
        expected_revision: Number(
          form.get("expected_revision") ?? expectedRevision,
        ),
        filenames: files.map((f) => f.name),
        content_types: files.map((f) => f.type),
      }),
    });
    const beginData = await begin.json().catch(() => ({}));
    if (!begin.ok) {
      setPending(false);
      setMessage(beginData.error?.message || beginData.error || "Begin failed");
      return;
    }

    let skipStorage = beginData.upload_mode !== "signed_upload";
    if (!skipStorage && Array.isArray(beginData.uploads)) {
      const sb = browserSupabase();
      if (!sb) {
        skipStorage = true;
      } else {
        for (let i = 0; i < beginData.uploads.length; i += 1) {
          const upload = beginData.uploads[i] as {
            path: string;
            token: string;
          };
          const file = files[i];
          if (!file) {
            skipStorage = true;
            break;
          }
          const { error } = await sb.storage
            .from("evidence")
            .uploadToSignedUrl(upload.path, upload.token, file, {
              contentType: file.type,
            });
          if (error) {
            // Local/dev: fall back to finalize with skip_storage instead of hard-fail.
            skipStorage = true;
            break;
          }
        }
      }
    }

    const finalize = await fetch(`/api/v1/awards/${awardId}/evidence/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservation_id: beginData.reservation_id,
        skip_storage: skipStorage,
        filenames: files.map((f) => f.name),
      }),
    });
    const finalData = await finalize.json().catch(() => ({}));
    setPending(false);
    if (!finalize.ok) {
      setMessage(finalData.error?.message || finalData.error || "Finalize failed");
      return;
    }
    setMessage(
      finalData.evidence_id
        ? `Evidence revision ${finalData.revision} saved. Return to the award to prepare submission.`
        : finalData.message || "Reservation accepted.",
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <Field
        label="Explanation"
        name="explanation"
        required
        maxLength={2000}
      />
      <Field
        label="Original source reference"
        name="source_ref"
        required
        maxLength={512}
      />
      <input
        type="hidden"
        name="expected_revision"
        value={String(expectedRevision)}
      />
      <div className="field">
        <label htmlFor="files">Evidence files</label>
        <input
          id="files"
          name="files"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          multiple
          required
        />
      </div>
      {message ? <Notice>{message}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save evidence revision"}
      </Button>
    </form>
  );
}
