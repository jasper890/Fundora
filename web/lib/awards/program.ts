import "server-only";
import { sql } from "../db";
import type { AwardStatus } from "../types";

export type ProgramSummary = {
  id: string;
  title: string;
  role: string;
  claim_deadline: string;
  review_deadline: string;
  payout_deadline: string;
  requirements_text: string;
};

export async function listProgramsForUser(userId: string): Promise<ProgramSummary[]> {
  const db = sql();
  const rows = (await db`
    select
      p.id,
      p.title,
      pm.role,
      p.claim_deadline,
      p.review_deadline,
      p.payout_deadline,
      p.requirements_text
    from program_member pm
    join program p on p.id = pm.program_id
    where pm.user_id = ${userId} and pm.active = true
    order by p.created_at desc
  `) as unknown as ProgramSummary[];
  return rows.map((row) => ({
    ...row,
    claim_deadline: new Date(row.claim_deadline).toISOString(),
    review_deadline: new Date(row.review_deadline).toISOString(),
    payout_deadline: new Date(row.payout_deadline).toISOString(),
  }));
}

export async function programCounts(programId: string): Promise<Record<string, number>> {
  const db = sql();
  const rows = (await db`
    select status, count(*)::int as n
    from award
    where program_id = ${programId} and last_confirmed_ledger is not null
    group by status
  `) as unknown as { status: AwardStatus; n: number }[];
  const counts: Record<string, number> = {
    CREATED: 0,
    FUNDED: 0,
    SUBMITTED: 0,
    APPROVED: 0,
    PAID: 0,
    REJECTED: 0,
    REFUNDED: 0,
    CANCELLED: 0,
  };
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}
