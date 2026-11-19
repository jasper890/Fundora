import { sql } from "@/lib/db";
import { jsonError, requireSameOrigin } from "@/lib/http";
import { isAwardVisible } from "@/lib/permissions";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { createEvidenceDownloadUrl } from "@/lib/evidence/storage";
import type { AwardView, MemberView, Role } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id: fileId } = await context.params;

  const user = await getRequestAuthUser(request);
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const db = sql();
  const rows = (await db`
    select
      ef.storage_name, ef.filename, ef.content_type,
      a.id as award_id, a.status, a.last_confirmed_ledger, a.sponsor_hold, a.verifier_hold,
      a.evidence_revision, a.evidence_digest, a.verifier_sync_required,
      sm.user_id as sponsor_user_id, sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
      vm.user_id as verifier_user_id, vm.active as verifier_active, vm.public_wallet as verifier_wallet,
      rm.user_id as recipient_user_id, rm.active as recipient_active, rm.public_wallet as recipient_wallet
    from evidence_file ef
    join evidence_version ev on ev.id = ef.version_id
    join award a on a.id = ev.award_id
    join program_member sm on sm.id = a.sponsor_member_id
    join program_member vm on vm.id = a.verifier_member_id
    join program_member rm on rm.id = a.recipient_member_id
    where ef.id = ${fileId}
      and ev.purged_at is null
    limit 1
  `) as unknown as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return jsonError("NOT_FOUND", 404);

  const member = (
    userId: string,
    role: Role,
    active: boolean,
    wallet: string,
  ): MemberView => ({ user_id: userId, role, active, public_wallet: wallet });

  const award = {
    id: String(row.award_id),
    status: row.status as AwardView["status"],
    last_confirmed_ledger: row.last_confirmed_ledger as number | null,
    sponsor_hold: Boolean(row.sponsor_hold),
    verifier_hold: Boolean(row.verifier_hold),
    evidence_revision: Number(row.evidence_revision),
    evidence_digest: String(row.evidence_digest),
    verifier_sync_required: Boolean(row.verifier_sync_required),
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
    latest_evidence: null,
    unresolved_operation: false,
  };

  if (!isAwardVisible(award, appUser)) return jsonError("NOT_FOUND", 404);

  const objectPath = String(row.storage_name);
  try {
    const url = await createEvidenceDownloadUrl(objectPath, 60, String(row.filename));
    return NextResponse.redirect(url, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError(
      "STORAGE_UNAVAILABLE",
      404,
      "Evidence bytes are unavailable for download in this environment.",
    );
  }
}
