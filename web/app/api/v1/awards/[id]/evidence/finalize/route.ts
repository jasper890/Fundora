import { randomBytes } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EVIDENCE_TYPE_ERROR, validateEvidenceBytes, validateEvidenceFilename } from "@/lib/evidence/validate";
import { canonicalManifest, sha256Hex } from "@/lib/evidence/manifest";
import { deleteEvidenceObjects, downloadEvidenceObject } from "@/lib/evidence/storage";

const Body = z.object({ reservation_id: z.string().uuid(), filenames: z.array(z.string().refine(validateEvidenceFilename)).min(1).max(3) }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id } = await context.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_BODY", 400);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const actor = user && await loadAppUserByAuthId(user.id);
  if (!actor?.is_active) return jsonError("UNAUTHENTICATED", 401);
  const db = sql();
  const [reservation] = await db`
    select r.* from evidence_upload_reservation r join award a on a.id = r.award_id
    join program_member m on m.id = a.recipient_member_id
    where r.id = ${parsed.data.reservation_id} and r.award_id = ${id} and r.author_id = ${actor.id}
      and r.finalized_at is null and m.user_id = ${actor.id} and m.active = true`;
  if (!reservation) return jsonError("NOT_FOUND", 404);
  const paths = reservation.object_paths as string[];
  try {
    if (paths.length !== parsed.data.filenames.length || !paths.length || paths.length > 3) throw new Error("INVALID_BODY");
    // Download and validate before taking row locks; object uploads cannot upsert.
    const files: { path: string; filename: string; contentType: string; size: number; digest: string }[] = [];
    for (let i = 0; i < paths.length; i += 1) {
      const data = await downloadEvidenceObject(paths[i]);
      const filename = parsed.data.filenames[i];
      const ext = filename.split(".").pop()?.toLowerCase();
      const contentType = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
      if (!validateEvidenceBytes(filename, contentType, data)) throw new Error("INVALID_FILE");
      files.push({ path: paths[i], filename, contentType, size: data.length, digest: sha256Hex(data) });
    }
    const result = await db.begin(async (tx) => {
      const [current] = await tx`select * from evidence_upload_reservation where id = ${reservation.id} and finalized_at is null for update`;
      if (!current) throw new Error("ALREADY_FINALIZED");
      const [award] = await tx`
        select a.*, p.claim_deadline, m.user_id as recipient_user, m.active as recipient_active
        from award a join program p on p.id = a.program_id join program_member m on m.id = a.recipient_member_id
        where a.id = ${id} for update of a`;
      if (!award || award.recipient_user !== actor.id || !award.recipient_active) throw new Error("NOT_FOUND");
      if (!["FUNDED", "SUBMITTED"].includes(award.status) || new Date(award.claim_deadline).getTime() < Date.now()) throw new Error("INVALID_STATE");
      if (Number(award.evidence_revision) !== Number(current.expected_revision)) throw new Error("STALE_REVISION");
      const revision = Number(award.evidence_revision) + 1;
      const nonce = randomBytes(32).toString("hex");
      const manifest = canonicalManifest({ awardId: id, revision, nonce,
        files: files.map(f => ({ filename: f.filename, sha256: f.digest, size: f.size, content_type: f.contentType })),
        sourceRef: current.source_ref, explanation: current.explanation });
      const digest = sha256Hex(manifest);
      const [version] = await tx`insert into evidence_version (award_id, revision, nonce, manifest, digest, explanation, source_ref, author_id)
        values (${id}, ${revision}, ${nonce}, ${manifest.toString("utf8")}, ${digest}, ${current.explanation}, ${current.source_ref}, ${actor.id}) returning id`;
      for (const file of files) await tx`insert into evidence_file (version_id, storage_name, filename, content_type, size, digest)
        values (${version.id}, ${file.path}, ${file.filename}, ${file.contentType}, ${file.size}, ${file.digest})`;
      await tx`update award set evidence_revision = ${revision}, evidence_digest = ${digest}, verifier_sync_required = true where id = ${id}`;
      await tx`update evidence_upload_reservation set finalized_at = now() where id = ${reservation.id}`;
      return { evidence_id: version.id, revision, digest };
    });
    return jsonOk({ ok: true, ...result, message: "Evidence revision stored after Storage content checks." });
  } catch (error) {
    // Delete only our still-unfinalized reservation, never another worker's committed objects.
    const abandoned = await db`delete from evidence_upload_reservation where id = ${reservation.id} and finalized_at is null returning object_paths`;
    if (abandoned[0]) await deleteEvidenceObjects(abandoned[0].object_paths as string[]).catch(() => undefined);
    const code = error instanceof Error ? error.message : "STORAGE_UNAVAILABLE";
    if (code === "NOT_FOUND") return jsonError(code, 404);
    if (["STALE_REVISION", "INVALID_STATE", "ALREADY_FINALIZED"].includes(code)) return jsonError(code, 409, "This award changed. Refresh before uploading a new revision.");
    if (code === "INVALID_BODY") return jsonError(code, 400);
    if (code === "INVALID_FILE") return jsonError(code, 400, EVIDENCE_TYPE_ERROR);
    return jsonError("STORAGE_UNAVAILABLE", 503, "The uploaded evidence could not be verified. No revision was saved.");
  }
}
