import { z } from "zod";
import { memberAssignmentChanges } from "@/lib/awards/memberAssignment";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidPublicKey } from "@/lib/wallet/validation";

const Body = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["SPONSOR", "VERIFIER", "RECIPIENT"]),
  public_wallet: z.string().length(56),
}).strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id: programId } = await context.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_BODY", 400);
  if (!isValidPublicKey(parsed.data.public_wallet)) return jsonError("INVALID_WALLET", 400);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser?.is_staff) return jsonError("FORBIDDEN", 403);

  const db = sql();
  try {
    const result = await db.begin(async (tx) => {
      const programs = (await tx`select id from program where id = ${programId} for update`) as unknown as { id: string }[];
      if (!programs[0]) throw Object.assign(new Error(), { code: "NOT_FOUND" });
      const target = (await tx`select id from app_user where id = ${parsed.data.user_id} and is_active = true`) as unknown as { id: string }[];
      if (!target[0]) throw Object.assign(new Error(), { code: "USER_NOT_FOUND" });

      const rows = (await tx`
        select id, role, public_wallet, active
        from program_member
        where program_id = ${programId} and user_id = ${parsed.data.user_id}
        for update
      `) as unknown as { id: string; role: string; public_wallet: string; active: boolean }[];
      const current = rows[0];
      if (current) {
        const next = { role: parsed.data.role, public_wallet: parsed.data.public_wallet, active: true };
        if (memberAssignmentChanges(current, next)) {
          const used = (await tx`
            select exists(
              select 1 from award
              where sponsor_member_id = ${current.id}
                 or verifier_member_id = ${current.id}
                 or recipient_member_id = ${current.id}
            ) as referenced
          `) as unknown as { referenced: boolean }[];
          if (used[0]?.referenced) throw Object.assign(new Error(), { code: "MEMBER_IN_USE" });
          const updated = (await tx`
            update program_member set role = ${next.role}, public_wallet = ${next.public_wallet}, active = true
            where id = ${current.id}
            returning id, role
          `) as unknown as { id: string; role: string }[];
          return { ...updated[0], created: false };
        }
        return { id: current.id, role: current.role, created: false };
      }

      const inserted = (await tx`
        insert into program_member (program_id, user_id, role, public_wallet, active)
        values (${programId}, ${parsed.data.user_id}, ${parsed.data.role}, ${parsed.data.public_wallet}, true)
        returning id, role
      `) as unknown as { id: string; role: string }[];
      return { ...inserted[0], created: true };
    });
    return jsonOk({ id: result.id, role: result.role }, result.created ? 201 : 200);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "NOT_FOUND" || code === "USER_NOT_FOUND") return jsonError("NOT_FOUND", 404);
    if (code === "MEMBER_IN_USE") return jsonError("MEMBER_IN_USE", 409, "This member is assigned to an award and cannot be changed.");
    console.error(error);
    return jsonError("SERVER_ERROR", 500);
  }
}
