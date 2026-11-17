import "server-only";
import { sql } from "@/lib/db";
import { TERMINAL } from "./constants";
import { useFakeRpc } from "./gateway";
import { LiveRpc } from "./live";
import { applyConfirmedAction } from "./apply";

/** Lightweight reconcile for SUBMITTED/UNKNOWN ops. FakeRpc path is a no-op. */
export async function reconcileOperation(operationId: string) {
  const db = sql();
  const rows = (await db`
    select * from chain_operation where id = ${operationId} limit 1
  `) as unknown as Record<string, unknown>[];
  const op = rows[0];
  if (!op) return null;
  if (TERMINAL.includes(op.status as never) || !op.signed_hash) {
    return op;
  }
  if (useFakeRpc()) {
    return op;
  }

  const live = new LiveRpc();
  let outcome: "SUCCESS" | "FAILED" | "NOT_FOUND" | "PENDING" = "PENDING";
  try {
    outcome = await live.getTransaction(String(op.signed_hash));
  } catch {
    await db`
      update chain_operation
      set status = 'UNKNOWN',
          error_code = 'RPC_UNAVAILABLE',
          last_checked_at = now()
      where id = ${operationId}
    `;
    return { ...op, status: "UNKNOWN" };
  }

  if (outcome === "PENDING" || outcome === "NOT_FOUND") {
    await db`
      update chain_operation
      set status = 'UNKNOWN',
          error_code = 'OUTCOME_UNKNOWN',
          last_checked_at = now()
      where id = ${operationId}
        and status not in ('CONFIRMED_SUCCESS','CONFIRMED_FAILED','ABANDONED','STALE')
    `;
    return { ...op, status: "UNKNOWN" };
  }

  if (outcome === "FAILED") {
    await db`
      update chain_operation
      set status = 'CONFIRMED_FAILED',
          last_checked_at = now()
      where id = ${operationId}
    `;
    await db`
      insert into chain_observation (operation_id, status, code)
      values (${operationId}, 'CONFIRMED_FAILED', ${""})
    `;
    return { ...op, status: "CONFIRMED_FAILED" };
  }

  const ledger = Math.floor(Date.now() / 1000);
  await db.begin(async (tx) => {
    await tx`
      update chain_operation
      set status = 'CONFIRMED_SUCCESS',
          confirmed_ledger = ${ledger},
          last_checked_at = now(),
          error_code = ''
      where id = ${operationId}
    `;
    await tx`
      insert into chain_observation (operation_id, status, code, ledger)
      values (${operationId}, 'CONFIRMED_SUCCESS', ${""}, ${ledger})
    `;
    await applyConfirmedAction(tx, {
      awardId: String(op.award_id),
      action: String(op.action),
      ledger,
      intent: op.intent as Record<string, unknown>,
    });
  });
  return { ...op, status: "CONFIRMED_SUCCESS", confirmed_ledger: ledger };
}
