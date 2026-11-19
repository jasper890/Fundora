import { z } from "zod";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { PermissionDeniedError, requireAwardRole } from "@/lib/permissions";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { getRequestAuthUser } from "@/lib/supabase/server";
import type { MemberView } from "@/lib/types";

const Body = z
  .object({
    evidence_id: z.string().uuid(),
    action: z.enum(["APPROVE", "REJECT", "REOPEN", "REQUEST_CHANGES", "DISPUTE"]),
    rationale: z.string().min(1).max(2000),
    source_check_method: z.string().max(512).optional(),
    source_confirmed: z.boolean().optional(),
    expected_version: z.string().regex(/^\d+$/),
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

  if (
    parsed.data.action === "APPROVE" &&
    (!parsed.data.source_confirmed || !parsed.data.source_check_method?.trim())
  ) {
    return jsonError(
      "SOURCE_CHECK_REQUIRED",
      400,
      "Confirm the original source before requesting approval.",
    );
  }

  const user = await getRequestAuthUser(request);
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const db = sql();
  try {
    const rows = (await db`
      select a.version, a.status, a.verifier_sync_required,
        sm.user_id as sponsor_user_id, sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
        vm.user_id as verifier_user_id, vm.active as verifier_active, vm.public_wallet as verifier_wallet,
        rm.user_id as recipient_user_id, rm.active as recipient_active, rm.public_wallet as recipient_wallet
      from award a
      join program_member sm on sm.id = a.sponsor_member_id
      join program_member vm on vm.id = a.verifier_member_id
      join program_member rm on rm.id = a.recipient_member_id
      where a.id = ${id}
      limit 1
    `) as unknown as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return jsonError("NOT_FOUND", 404);

    const member = (
      userId: string,
      role: "SPONSOR" | "VERIFIER" | "RECIPIENT",
      active: boolean,
      wallet: string,
    ): MemberView => ({ user_id: userId, role, active, public_wallet: wallet });

    const access = {
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
    };

    const roles =
      parsed.data.action === "DISPUTE"
        ? (["RECIPIENT"] as const)
        : (["VERIFIER"] as const);
    requireAwardRole(appUser, access, [...roles]);

    const evidence = (await db`
      select id from evidence_version
      where id = ${parsed.data.evidence_id} and award_id = ${id}
      limit 1
    `) as unknown as { id: string }[];
    if (!evidence[0]) return jsonError("NOT_FOUND", 404);

    if (String(row.version) !== parsed.data.expected_version) {
      return jsonError("STALE_VERSION", 409, "Award changed. Refresh before reviewing.");
    }

    const inserted = (await db`
      insert into review_action (
        award_id, evidence_id, verifier_id, action, rationale,
        source_check_method, source_confirmed, expected_version, status
      ) values (
        ${id},
        ${parsed.data.evidence_id},
        ${appUser.id},
        ${parsed.data.action},
        ${parsed.data.rationale},
        ${parsed.data.source_check_method ?? ""},
        ${Boolean(parsed.data.source_confirmed)},
        ${BigInt(parsed.data.expected_version)},
        ${"PENDING"}
      )
      returning id, action, status
    `) as unknown as { id: string; action: string; status: string }[];

    return jsonOk(
      {
        id: inserted[0].id,
        action: inserted[0].action,
        status: inserted[0].status,
      },
      201,
    );
  } catch (error) {
    if (error instanceof PermissionDeniedError) return jsonError("FORBIDDEN", 403);
    console.error(error);
    return jsonError("SERVER_ERROR", 500);
  }
}
