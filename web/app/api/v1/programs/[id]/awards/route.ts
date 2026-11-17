import { z } from "zod";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidPublicKey } from "@/lib/wallet/validation";

const Body = z
  .object({
    recipient_user_id: z.string().uuid(),
    recipient_wallet: z.string().min(56).max(56),
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
  if (!isValidPublicKey(parsed.data.recipient_wallet)) {
    return jsonError("INVALID_WALLET", 400, "Recipient wallet must be a valid Stellar public key.");
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
    const created = await db.begin(async (tx) => {
      const programs = (await tx`
        select id, sponsor_user_id, verifier_user_id
        from program
        where id = ${programId}
        for update
      `) as unknown as {
        id: string;
        sponsor_user_id: string;
        verifier_user_id: string;
      }[];
      const program = programs[0];
      if (!program) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
      if (program.sponsor_user_id !== appUser.id && !appUser.is_staff) {
        throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
      }

      const members = (await tx`
        select id, user_id, role, public_wallet, active
        from program_member
        where program_id = ${programId}
      `) as unknown as {
        id: string;
        user_id: string;
        role: string;
        public_wallet: string;
        active: boolean;
      }[];

      const sponsor = members.find((m) => m.role === "SPONSOR" && m.active);
      const verifier = members.find((m) => m.role === "VERIFIER" && m.active);
      if (!sponsor || !verifier) {
        throw Object.assign(new Error("INVALID_STATE"), { code: "INVALID_STATE" });
      }

      let recipient = members.find(
        (m) => m.user_id === parsed.data.recipient_user_id && m.role === "RECIPIENT",
      );
      if (!recipient) {
        const inserted = (await tx`
          insert into program_member (program_id, user_id, role, public_wallet, active)
          values (
            ${programId},
            ${parsed.data.recipient_user_id},
            ${"RECIPIENT"},
            ${parsed.data.recipient_wallet},
            true
          )
          returning id, user_id, role, public_wallet, active
        `) as unknown as typeof members;
        recipient = inserted[0];
      } else if (recipient.public_wallet !== parsed.data.recipient_wallet) {
        throw Object.assign(new Error("WALLET_MISMATCH"), { code: "WALLET_MISMATCH" });
      }

      const existing = (await tx`
        select id from award
        where program_id = ${programId}
          and recipient_member_id = ${recipient!.id}
        limit 1
      `) as unknown as { id: string }[];
      if (existing[0]) {
        throw Object.assign(new Error("DUPLICATE_AWARD"), { code: "DUPLICATE_AWARD" });
      }

      const awards = (await tx`
        insert into award (
          program_id, sponsor_member_id, verifier_member_id, recipient_member_id,
          base_units, status, version
        ) values (
          ${programId}, ${sponsor.id}, ${verifier.id}, ${recipient!.id},
          200000000, 'CREATED', 0
        )
        returning id, status
      `) as unknown as { id: string; status: string }[];
      return awards[0];
    });

    return jsonOk({ id: created.id, status: created.status }, 201);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "NOT_FOUND") return jsonError("NOT_FOUND", 404);
    if (code === "FORBIDDEN") return jsonError("FORBIDDEN", 403);
    if (code === "DUPLICATE_AWARD") {
      return jsonError("DUPLICATE_AWARD", 409, "Recipient already has an award in this program.");
    }
    if (code === "WALLET_MISMATCH") {
      return jsonError("WALLET_MISMATCH", 409, "Existing recipient wallet does not match.");
    }
    if (code === "INVALID_STATE") {
      return jsonError("INVALID_STATE", 409, "Program needs active sponsor and verifier members.");
    }
    console.error(error);
    return jsonError("SERVER_ERROR", 500);
  }
}
