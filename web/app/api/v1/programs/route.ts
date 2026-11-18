import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { loadProjectVerifierOptions } from "@/lib/awards/projectCreation";

const Body = z.strictObject({
  title: z.string().trim().min(1).max(160),
  requirements_text: z.string().trim().min(1).max(4000),
  verifier_member_id: z.uuid(),
  claim_deadline: z.iso.datetime(),
  review_deadline: z.iso.datetime(),
  payout_deadline: z.iso.datetime(),
});

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const user = await getSessionUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  if (!user.is_active || user.must_change_password) return jsonError("FORBIDDEN", 403);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_BODY", 400, "Enter a title, completion requirements, verifier, and all three deadlines.");
  const input = parsed.data;
  const claim = Date.parse(input.claim_deadline);
  const review = Date.parse(input.review_deadline);
  const payout = Date.parse(input.payout_deadline);
  if (!(Date.now() < claim && claim < review && review < payout)) {
    return jsonError("INVALID_DEADLINES", 400, "Choose future deadlines in order: submission, review, then payout.");
  }

  try {
    const project = await withTransaction(async (tx) => {
      const options = await loadProjectVerifierOptions(user.id, tx);
      const verifier = options.find((option) => option.id === input.verifier_member_id);
      if (!verifier) return null;
      const [program] = await tx<{ id: string }[]>`
        insert into program (
          title, requirements_text, sponsor_user_id, verifier_user_id,
          claim_deadline, review_deadline, payout_deadline
        ) values (
          ${input.title}, ${input.requirements_text}, ${user.id}, ${verifier.verifier_user_id},
          ${input.claim_deadline}, ${input.review_deadline}, ${input.payout_deadline}
        ) returning id
      `;
      await tx`
        insert into program_member (program_id, user_id, role, public_wallet)
        values
          (${program.id}, ${user.id}, 'SPONSOR', ${verifier.sponsor_wallet}),
          (${program.id}, ${verifier.verifier_user_id}, 'VERIFIER', ${verifier.verifier_wallet})
      `;
      return program;
    });
    if (!project) return jsonError("FORBIDDEN", 403, "Choose an active verifier from a project you sponsor.");
    return jsonOk(project, 201);
  } catch {
    return jsonError("CREATE_FAILED", 500, "The project could not be saved. Try again.");
  }
}
