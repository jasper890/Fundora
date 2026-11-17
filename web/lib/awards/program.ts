import "server-only";
import { sql } from "../db";
import type { AwardStatus, Role } from "../types";

export type ProgramSummary = {
  id: string;
  title: string;
  role: Role;
  claim_deadline: string;
  review_deadline: string;
  payout_deadline: string;
  requirements_text: string;
};

export type ReplacementVerifierOption = { id: string; username: string; wallet: string };

export async function loadReplacementVerifierOptions(
  programId: string,
  currentVerifierMemberId: string,
  sponsorUserId: string,
  recipientUserId: string,
): Promise<ReplacementVerifierOption[]> {
  const db = sql();
  return (await db`
    select pm.id, u.username, pm.public_wallet as wallet
    from program_member pm
    join app_user u on u.id = pm.user_id
    where pm.program_id = ${programId}
      and pm.role = 'VERIFIER'
      and pm.active = true
      and u.is_active = true
      and pm.id <> ${currentVerifierMemberId}
      and pm.user_id <> ${sponsorUserId}
      and pm.user_id <> ${recipientUserId}
    order by u.username
  `) as unknown as ReplacementVerifierOption[];
}

export async function loadProgramForUser(
  programId: string,
  userId: string,
): Promise<ProgramSummary | null> {
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
    from program p
    join program_member pm on pm.program_id = p.id
    where p.id = ${programId}
      and pm.user_id = ${userId}
      and pm.active = true
    limit 1
  `) as unknown as ProgramSummary[];
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    claim_deadline: new Date(row.claim_deadline).toISOString(),
    review_deadline: new Date(row.review_deadline).toISOString(),
    payout_deadline: new Date(row.payout_deadline).toISOString(),
  };
}

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
