import { randomBytes } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EVIDENCE_TYPE_ERROR,
  validateEvidenceBytes,
} from "@/lib/evidence/validate";
import { canonicalManifest, sha256Hex } from "@/lib/evidence/manifest";
import {
  deleteEvidenceObjects,
  downloadEvidenceObject,
} from "@/lib/evidence/storage";

const Body = z
  .object({
    reservation_id: z.string().uuid(),
    skip_storage: z.boolean().optional(),
    note: z.string().max(200).optional(),
    filenames: z.array(z.string().max(160)).min(1).max(3).optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id } = await context.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_BODY", 400);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const db = sql();
  const orphanPaths: string[] = [];

  try {
    const result = await db.begin(async (tx) => {
      const rows = (await tx`
        select *
        from evidence_upload_reservation
        where id = ${parsed.data.reservation_id}
          and award_id = ${id}
          and author_id = ${appUser.id}
          and finalized_at is null
        limit 1
        for update
      `) as unknown as {
        id: string;
        expected_revision: number;
        explanation: string;
        source_ref: string;
        object_paths: string[];
      }[];
      const reservation = rows[0];
      if (!reservation) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });

      const awards = (await tx`
        select evidence_revision, status
        from award
        where id = ${id}
        for update
      `) as unknown as { evidence_revision: number; status: string }[];
      const award = awards[0];
      if (!award) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
      if (award.status !== "FUNDED" && award.status !== "SUBMITTED") {
        throw Object.assign(new Error("INVALID_STATE"), { code: "INVALID_STATE" });
      }
      if (Number(award.evidence_revision) !== Number(reservation.expected_revision)) {
        throw Object.assign(new Error("STALE_REVISION"), { code: "STALE_REVISION" });
      }

      const paths = reservation.object_paths ?? [];
      orphanPaths.push(...paths);
      const nextRevision = Number(award.evidence_revision) + 1;
      const nonce = randomBytes(32).toString("hex");

      const prepared: {
        path: string;
        filename: string;
        contentType: string;
        size: number;
        digest: string;
        storageName: string;
      }[] = [];

      const originalNames = parsed.data.filenames ?? [];
      if (originalNames.length && originalNames.length !== paths.length) {
        throw Object.assign(new Error("INVALID_BODY"), { code: "INVALID_BODY" });
      }

      if (parsed.data.skip_storage) {
        for (let i = 0; i < paths.length; i += 1) {
          const path = paths[i]!;
          const filename = (originalNames[i] ?? `evidence-${i + 1}.bin`).slice(0, 160);
          const digest = sha256Hex(`${path}|${nonce}|skip`);
          prepared.push({
            path,
            filename,
            contentType: "application/octet-stream",
            size: 1,
            digest,
            storageName: path.slice(0, 80),
          });
        }
      } else {
        for (let i = 0; i < paths.length; i += 1) {
          const path = paths[i]!;
          const data = await downloadEvidenceObject(path);
          const filename = (originalNames[i] ?? `evidence-${i + 1}.bin`).slice(0, 160);
          const ext = filename.includes(".")
            ? `.${filename.split(".").pop()!.toLowerCase()}`
            : "";
          const contentType =
            ext === ".pdf"
              ? "application/pdf"
              : ext === ".png"
                ? "image/png"
                : ext === ".jpg" || ext === ".jpeg"
                  ? "image/jpeg"
                  : "application/octet-stream";
          if (!validateEvidenceBytes(filename, contentType, data)) {
            throw Object.assign(new Error("INVALID_FILE"), { code: "INVALID_FILE" });
          }
          prepared.push({
            path,
            filename,
            contentType,
            size: data.length,
            digest: sha256Hex(data),
            storageName: path.slice(0, 80),
          });
        }
      }

      const manifestBuf = canonicalManifest({
        awardId: id,
        revision: nextRevision,
        nonce,
        files: prepared.map((p) => ({
          filename: p.filename,
          sha256: p.digest,
          size: p.size,
          content_type: p.contentType,
        })),
        sourceRef: reservation.source_ref,
        explanation: reservation.explanation,
      });
      const digest = sha256Hex(manifestBuf);
      const manifest = manifestBuf.toString("utf8");

      const versions = (await tx`
        insert into evidence_version (
          award_id, revision, nonce, manifest, digest,
          explanation, source_ref, author_id
        ) values (
          ${id}, ${nextRevision}, ${nonce}, ${manifest}, ${digest},
          ${reservation.explanation}, ${reservation.source_ref}, ${appUser.id}
        )
        returning id, revision, digest
      `) as unknown as { id: string; revision: number; digest: string }[];

      for (const file of prepared) {
        await tx`
          insert into evidence_file (
            version_id, storage_name, filename, content_type, size, digest
          ) values (
            ${versions[0].id},
            ${file.storageName},
            ${file.filename},
            ${file.contentType},
            ${file.size},
            ${file.digest}
          )
        `;
      }

      await tx`
        update award
        set evidence_revision = ${nextRevision},
            evidence_digest = ${digest},
            verifier_sync_required = true
        where id = ${id}
      `;

      await tx`
        update evidence_upload_reservation
        set finalized_at = now()
        where id = ${parsed.data.reservation_id}
      `;

      orphanPaths.length = 0;
      return {
        ...versions[0],
        skip: Boolean(parsed.data.skip_storage),
      };
    });

    return jsonOk({
      ok: true,
      evidence_id: result.id,
      revision: result.revision,
      digest: result.digest,
      message: result.skip
        ? "Local skip_storage finalize created an evidence_version."
        : "Evidence revision stored after Storage magic-byte checks.",
    });
  } catch (error) {
    if (orphanPaths.length && !parsed.data.skip_storage) {
      await deleteEvidenceObjects(orphanPaths).catch(() => undefined);
    }
    const code = (error as { code?: string }).code;
    if (code === "NOT_FOUND") return jsonError("NOT_FOUND", 404);
    if (code === "INVALID_STATE") {
      return jsonError(
        "INVALID_STATE",
        409,
        "Evidence can be added only to a funded or submitted award.",
      );
    }
    if (code === "STALE_REVISION") {
      return jsonError("STALE_REVISION", 409, "Evidence revision changed. Reload and try again.");
    }
    if (code === "INVALID_BODY") return jsonError("INVALID_BODY", 400);
    if (code === "INVALID_FILE") {
      return jsonError("INVALID_FILE", 400, EVIDENCE_TYPE_ERROR);
    }
    console.error(error);
    return jsonError("SERVER_ERROR", 500);
  }
}
