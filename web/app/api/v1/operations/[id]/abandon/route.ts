import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id } = await context.params;
  await request.json().catch(() => ({}));

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const db = sql();
  try {
    const updated = await db.begin(async (tx) => {
      const rows = (await tx`
        select id, status, signed_hash, signed_xdr
        from chain_operation
        where id = ${id} and actor_id = ${appUser.id}
        limit 1
        for update
      `) as unknown as {
        id: string;
        status: string;
        signed_hash: string | null;
        signed_xdr: string;
      }[];
      const op = rows[0];
      if (!op) return null;
      if (
        op.status !== "PREPARED" ||
        op.signed_hash ||
        (op.signed_xdr && op.signed_xdr.length > 0)
      ) {
        throw Object.assign(new Error("UNRESOLVED_OPERATION"), {
          code: "UNRESOLVED_OPERATION",
        });
      }
      await tx`
        update chain_operation
        set status = 'ABANDONED',
            error_code = 'WALLET_DECLINED',
            last_checked_at = now()
        where id = ${id}
      `;
      await tx`
        insert into chain_observation (operation_id, status, code)
        values (${id}, 'ABANDONED', ${"WALLET_DECLINED"})
      `;
      return op.id;
    });

    if (!updated) return jsonError("NOT_FOUND", 404);
    return jsonOk({ id, status: "ABANDONED", error_code: "WALLET_DECLINED" });
  } catch (error) {
    if ((error as { code?: string }).code === "UNRESOLVED_OPERATION") {
      return jsonError(
        "UNRESOLVED_OPERATION",
        409,
        "Only unsigned PREPARED operations can be abandoned.",
      );
    }
    console.error(error);
    return jsonError("SERVER_ERROR", 500);
  }
}
