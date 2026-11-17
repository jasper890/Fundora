import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Body = z
  .object({
    reservation_id: z.string().uuid(),
    skip_storage: z.boolean().optional(),
    note: z.string().max(200).optional(),
  })
  .strict();

function syntheticDigest(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

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

  if (!parsed.data.skip_storage) {
    return jsonError(
      "STORAGE_REQUIRED",
      501,
      "Full finalize with magic-byte checks requires Storage objects.",
    );
  }

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

      const nextRevision = Number(award.evidence_revision) + 1;
      const nonce = randomBytes(16).toString("hex");
      const paths = reservation.object_paths ?? [];
      const digest = syntheticDigest([
        id,
        String(nextRevision),
        nonce,
        reservation.explanation,
        reservation.source_ref,
        ...paths,
      ]);
      const manifest = JSON.stringify({
        revision: nextRevision,
        paths,
        note: parsed.data.note ?? "skip_storage local finalize",
      });

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

      for (let i = 0; i < paths.length; i += 1) {
        const path = paths[i]!;
        const filename = path.split("/").pop() ?? `file-${i}`;
        const fileDigest = syntheticDigest([path, digest]);
        await tx`
          insert into evidence_file (
            version_id, storage_name, filename, content_type, size, digest
          ) values (
            ${versions[0].id},
            ${`${versions[0].id}-${i}`},
            ${filename.slice(0, 160)},
            ${"application/octet-stream"},
            ${1},
            ${fileDigest}
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

      return versions[0];
    });

    return jsonOk({
      ok: true,
      evidence_id: result.id,
      revision: result.revision,
      digest: result.digest,
      message:
        "Local skip_storage finalize created an evidence_version. Wire Storage signed uploads for real file bytes.",
    });
  } catch (error) {
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
    console.error(error);
    return jsonError("SERVER_ERROR", 500);
  }
}
