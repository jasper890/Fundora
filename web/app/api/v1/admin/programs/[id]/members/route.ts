import { z } from "zod";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidPublicKey } from "@/lib/wallet/validation";

const Body = z
  .object({
    user_id: z.string().uuid(),
    role: z.enum(["SPONSOR", "VERIFIER", "RECIPIENT"]),
    public_wallet: z.string().min(56).max(56),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id: programId } = await context.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_BODY", 400);
  if (!isValidPublicKey(parsed.data.public_wallet)) {
    return jsonError("INVALID_WALLET", 400);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser?.is_staff) return jsonError("FORBIDDEN", 403);

  const db = sql();
  try {
    const inserted = (await db`
      insert into program_member (program_id, user_id, role, public_wallet, active)
      values (
        ${programId},
        ${parsed.data.user_id},
        ${parsed.data.role},
        ${parsed.data.public_wallet},
        true
      )
      on conflict (program_id, user_id) do update set
        role = excluded.role,
        public_wallet = excluded.public_wallet,
        active = true
      returning id, role
    `) as unknown as { id: string; role: string }[];
    return jsonOk({ id: inserted[0].id, role: inserted[0].role }, 201);
  } catch (error) {
    console.error(error);
    return jsonError("SERVER_ERROR", 500);
  }
}
