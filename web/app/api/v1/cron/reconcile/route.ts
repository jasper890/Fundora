import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { reconcileOperation } from "@/lib/chain/reconcile";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (!secret || header !== `Bearer ${secret}`) {
    return jsonError("FORBIDDEN", 403);
  }

  const db = sql();
  const pending = (await db`
    select id from chain_operation
    where status in ('SUBMITTED', 'UNKNOWN', 'SIGNED')
      and signed_hash is not null
      and signed_hash <> ''
    order by created_at
    limit 50
  `) as unknown as { id: string }[];

  const results = [];
  for (const row of pending) {
    const op = await reconcileOperation(row.id);
    results.push({ id: row.id, status: op?.status ?? null });
  }
  return jsonOk({ reconciled: results.length, results });
}
