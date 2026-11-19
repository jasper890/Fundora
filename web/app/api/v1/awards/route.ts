import { jsonError, jsonOk } from "@/lib/http";
import { listVisibleAwardsForUser, loadAppUserByAuthId, loadAwardMobileContext, myRoles } from "@/lib/awards/queries";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { AWARD_AMOUNT } from "@/lib/types";

/** Awards the signed-in user can see as sponsor, verifier or recipient (mobile app list). */
export async function GET(request: Request) {
  const user = await getRequestAuthUser(request);
  const appUser = user && (await loadAppUserByAuthId(user.id));
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);
  const awards = await listVisibleAwardsForUser(appUser);
  const context = await loadAwardMobileContext(awards.map((a) => a.id), appUser.id);
  return jsonOk({
    amount_base_units: String(AWARD_AMOUNT),
    awards: awards.map((award) => ({ ...award, ...context.get(award.id), my_roles: myRoles(award, appUser.id) })),
  });
}
