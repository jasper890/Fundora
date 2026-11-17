import { z } from "zod";
import { ChainError } from "@/lib/chain/constants";
import { FakeRpc } from "@/lib/chain/rpc";
import { applyConfirmedAction } from "@/lib/chain/apply";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Body = z
  .object({
    signed_xdr: z.string().min(1).max(200_000),
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

  const allow = process.env.STELLAR_ALLOW_SUBMISSION === "1";
  // FakeRpc local path is always allowed; live RPC still gated.
  const forceFake = process.env.STELLAR_USE_FAKE_RPC !== "0";

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
      select *
      from chain_operation
      where id = ${id}
        and actor_id = ${appUser.id}
      limit 1
    `) as unknown as Record<string, unknown>[];
    const op = rows[0];
    if (!op) return jsonError("NOT_FOUND", 404);

    if (op.status === "CONFIRMED_SUCCESS") {
      return jsonOk({ id, status: op.status });
    }
    if (op.status !== "PREPARED" && op.status !== "SIGNED") {
      return jsonError("INVALID_STATE", 409, "Operation is not ready to submit.");
    }

    if (!forceFake && !allow) {
      return jsonError(
        "SUBMISSION_DISABLED",
        403,
        "Set STELLAR_ALLOW_SUBMISSION=1 for live Testnet submission.",
      );
    }

    const signed = parsed.data.signed_xdr;
    if (!forceFake && !signed.startsWith(String(op.unsigned_xdr))) {
      // Live path would validate envelope equality; FakeRpc accepts FAKE-* markers.
      return jsonError("INVALID_SIGNED_XDR", 400);
    }

    await db`
      update chain_operation
      set signed_xdr = ${signed},
          signed_hash = ${`signed-${id}`},
          status = 'SIGNED'
      where id = ${id}
    `;

    const rpc = new FakeRpc({
      status: "CREATED",
      version: 0,
      evidence_revision: 0,
      evidence_digest: null,
      verifier: "",
      sponsor_hold: false,
      verifier_hold: false,
    });
    const submitted = await rpc.submit(signed);

    await db`
      update chain_operation
      set status = 'SUBMITTED'
      where id = ${id}
    `;
    await db`
      insert into chain_observation (operation_id, status, code)
      values (${id}, 'SUBMITTED', ${""})
    `;

    // Local FakeRpc: confirm immediately and apply award transition.
    const ledger = Math.floor(Date.now() / 1000);
    await db.begin(async (tx) => {
      await tx`
        update chain_operation
        set status = 'CONFIRMED_SUCCESS',
            confirmed_ledger = ${ledger},
            last_checked_at = now()
        where id = ${id}
      `;
      await tx`
        insert into chain_observation (operation_id, status, code, ledger)
        values (${id}, 'CONFIRMED_SUCCESS', ${""}, ${ledger})
      `;
      await applyConfirmedAction(tx, {
        awardId: String(op.award_id),
        action: String(op.action),
        ledger,
        intent: op.intent as Record<string, unknown>,
      });
    });

    return jsonOk(
      {
        id,
        status: "CONFIRMED_SUCCESS",
        hash: submitted.hash,
        confirmed_ledger: ledger,
      },
      202,
    );
  } catch (error) {
    if (error instanceof ChainError) return jsonError(error.code, error.status);
    console.error(error);
    return jsonError("RPC_UNAVAILABLE", 503);
  }
}
