import { z } from "zod";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { PermissionDeniedError, requireAwardRole } from "@/lib/permissions";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberView } from "@/lib/types";
import { validateEvidenceFilename } from "@/lib/evidence/validate";
import { createEvidenceUploadTokens } from "@/lib/evidence/storage";

const Body = z
  .object({
    explanation: z.string().min(1).max(2000),
    source_ref: z.string().min(1).max(512),
    expected_revision: z.number().int().min(0),
    filenames: z.array(z.string()).min(1).max(3),
    content_types: z.array(z.string()).min(1).max(3),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id } = await context.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_BODY", 400, "Invalid evidence request.");

  if (parsed.data.filenames.length !== parsed.data.content_types.length) {
    return jsonError("INVALID_BODY", 400, "filenames and content_types length must match.");
  }

  for (const name of parsed.data.filenames) {
    if (!validateEvidenceFilename(name)) {
      return jsonError("INVALID_FILENAME", 400, "Use a filename without paths or control characters.");
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const db = sql();
  try {
    const rows = (await db`
      select a.evidence_revision, a.status, a.verifier_sync_required,
        rm.user_id as recipient_user_id, rm.active as recipient_active, rm.public_wallet as recipient_wallet,
        sm.user_id as sponsor_user_id, sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
        vm.user_id as verifier_user_id, vm.active as verifier_active, vm.public_wallet as verifier_wallet
      from award a
      join program_member sm on sm.id = a.sponsor_member_id
      join program_member vm on vm.id = a.verifier_member_id
      join program_member rm on rm.id = a.recipient_member_id
      where a.id = ${id}
      for update of a
    `) as unknown as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return jsonError("NOT_FOUND", 404);

    const member = (
      userId: string,
      role: "SPONSOR" | "VERIFIER" | "RECIPIENT",
      active: boolean,
      wallet: string,
    ): MemberView => ({ user_id: userId, role, active, public_wallet: wallet });

    requireAwardRole(
      appUser,
      {
        sponsor_member: member(
          String(row.sponsor_user_id),
          "SPONSOR",
          Boolean(row.sponsor_active),
          String(row.sponsor_wallet),
        ),
        verifier_member: member(
          String(row.verifier_user_id),
          "VERIFIER",
          Boolean(row.verifier_active),
          String(row.verifier_wallet),
        ),
        recipient_member: member(
          String(row.recipient_user_id),
          "RECIPIENT",
          Boolean(row.recipient_active),
          String(row.recipient_wallet),
        ),
        verifier_sync_required: Boolean(row.verifier_sync_required),
      },
      ["RECIPIENT"],
    );

    if (row.status !== "FUNDED" && row.status !== "SUBMITTED") {
      return jsonError(
        "INVALID_STATE",
        409,
        "Evidence can be added only to a funded or submitted award before the claim deadline.",
      );
    }
    if (Number(row.evidence_revision) !== parsed.data.expected_revision) {
      return jsonError("STALE_REVISION", 409, "Evidence revision changed. Reload and try again.");
    }

    // Keep object keys ≤80 chars to match evidence_file.storage_name.
    const paths = parsed.data.filenames.map(
      () => `${crypto.randomUUID().replace(/-/g, "")}.bin`,
    );

    const inserted = (await db`
      insert into evidence_upload_reservation (
        award_id, author_id, expected_revision, explanation, source_ref, object_paths
      ) values (
        ${id}, ${appUser.id}, ${parsed.data.expected_revision},
        ${parsed.data.explanation}, ${parsed.data.source_ref}, ${paths}
      )
      returning id
    `) as unknown as { id: string }[];

    let uploads: { path: string; token: string; signedUrl: string }[] = [];
    let uploadMode: "signed_upload" | "deferred_storage" = "signed_upload";
    try {
      uploads = await createEvidenceUploadTokens(paths);
    } catch (error) {
      console.warn("Signed upload unavailable; client may use skip_storage.", error);
      uploadMode = "deferred_storage";
    }

    return jsonOk({
      reservation_id: inserted[0].id,
      object_paths: paths,
      content_types: parsed.data.content_types,
      uploads,
      upload_mode: uploadMode,
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) return jsonError("FORBIDDEN", 403);
    console.error(error);
    return jsonError("SERVER_ERROR", 500);
  }
}
