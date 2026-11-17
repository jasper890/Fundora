"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { Notice } from "./Notice";

export function EvidenceUploadForm({ awardId, expectedRevision = 0 }: { awardId: string; expectedRevision?: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState("");
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage(null);
    const form = new FormData(event.currentTarget);
    let reservationId: string | undefined;
    try {
      const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
      if (!files.length || files.length > 3) throw new Error("Upload between one and three files.");
      if (files.some(file => file.size > 5 * 1024 * 1024)) throw new Error("Each file must be 5 MiB or smaller.");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("Evidence storage is unavailable. Try again later.");
      setStage("Preparing secure upload…");
      const begin = await fetch(`/api/v1/awards/${awardId}/evidence/begin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explanation: String(form.get("explanation") ?? ""), source_ref: String(form.get("source_ref") ?? ""),
          expected_revision: Number(form.get("expected_revision") ?? expectedRevision),
          filenames: files.map(f => f.name), content_types: files.map(f => f.type) }),
      });
      const begun = await begin.json().catch(() => ({}));
      if (!begin.ok) throw new Error(begun.error?.message || begun.error || "Could not prepare evidence upload.");
      reservationId = begun.reservation_id;
      if (begun.upload_mode !== "signed_upload" || begun.uploads?.length !== files.length) throw new Error("Secure evidence storage is unavailable. No revision was saved.");
      const storage = createClient(url, key, { auth: { persistSession: false } });
      for (let i = 0; i < files.length; i += 1) {
        setStage(`Uploading file ${i + 1} of ${files.length}…`);
        const { error } = await storage.storage.from("evidence").uploadToSignedUrl(begun.uploads[i].path, begun.uploads[i].token, files[i], { contentType: files[i].type });
        if (error) throw new Error("Upload failed. No revision was saved. Check your connection and try again.");
      }
      setStage("Verifying uploaded files…");
      const finalize = await fetch(`/api/v1/awards/${awardId}/evidence/finalize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: begun.reservation_id, filenames: files.map(f => f.name) }),
      });
      const saved = await finalize.json().catch(() => ({}));
      if (!finalize.ok) throw new Error(saved.error?.message || saved.error || "Could not verify uploaded evidence.");
      setMessage(`Evidence revision ${saved.revision} saved. Return to the award to prepare submission.`);
      router.refresh();
    } catch (error) {
      if (reservationId) await fetch(`/api/v1/awards/${awardId}/evidence/begin`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservation_id: reservationId }),
      }).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally { setPending(false); setStage(""); }
  }
  return <form onSubmit={onSubmit} aria-busy={pending}>
    <Field label="Explanation" name="explanation" required maxLength={2000} />
    <Field label="Original source reference" name="source_ref" required maxLength={512} />
    <input type="hidden" name="expected_revision" value={String(expectedRevision)} />
    <div className="field"><label htmlFor="files">Evidence files</label>
      <input id="files" name="files" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple required aria-describedby="evidence-file-help" />
      <p id="evidence-file-help" className="muted">One to three PDF, JPEG or PNG files, up to 5 MiB each. Evidence stays private.</p>
    </div>
    <div aria-live="polite">{stage ? <p>{stage}</p> : null}{message ? <Notice>{message}</Notice> : null}</div>
    <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save evidence revision"}</Button>
  </form>;
}
