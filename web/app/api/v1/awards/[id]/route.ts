import { sql } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { loadProgramForUser } from "@/lib/awards/program";
import {
  listVisibleAwardsForUser,
  loadAppUserByAuthId,
  loadAwardMobileContext,
  loadEvidenceHistoryForUser,
  loadReviewNotesForUser,
  myRoles,
} from "@/lib/awards/queries";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { AWARD_AMOUNT } from "@/lib/types";

/** One visible award with its program terms and evidence history (mobile app detail). */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestAuthUser(request);
  const appUser = user && (await loadAppUserByAuthId(user.id));
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);
  const { id } = await context.params;
  // shortcut: scans the user's visible awards (≤ a few dozen in the demo); add an id filter to the query if lists grow.
  const award = (await listVisibleAwardsForUser(appUser)).find((a) => a.id === id);
  if (!award) return jsonError("NOT_FOUND", 404);
  const program = await loadProgramForUser(award.program_id, appUser.id);
  if (!program) return jsonError("NOT_FOUND", 404);
  // Review actions must send the current contract version (expected_version).
  const [row] = (await sql()`select version::text as version from award where id = ${id}`) as unknown as {
    version: string;
  }[];
  if (!row) return jsonError("NOT_FOUND", 404);
  return jsonOk({
    award: {
      ...award,
      ...(await loadAwardMobileContext([id], appUser.id)).get(id),
      version: row.version,
      my_roles: myRoles(award, appUser.id),
    },
    program: {
      id: program.id,
      title: program.title,
      requirements_text: program.requirements_text,
      claim_deadline: program.claim_deadline,
      review_deadline: program.review_deadline,
      payout_deadline: program.payout_deadline,
    },
    amount_base_units: String(AWARD_AMOUNT),
    evidence: await loadEvidenceHistoryForUser(id, appUser),
    notes: await loadReviewNotesForUser(id, appUser),
  });
}
