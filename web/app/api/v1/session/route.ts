import { jsonOk } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getRequestAuthUser(request);
  if (!user) {
    return jsonOk({ authenticated: false });
  }
  const profile = await loadAppUserByAuthId(user.id);
  if (!profile) {
    return jsonOk({ authenticated: false });
  }
  const db = sql();
  const memberships = (await db`
    select pm.program_id, pm.role, pm.public_wallet, p.title
    from program_member pm
    join program p on p.id = pm.program_id
    where pm.user_id = ${profile.id} and pm.active = true
  `) as unknown as { program_id: string; role: string; public_wallet: string; title: string }[];
  return jsonOk({
    authenticated: true,
    username: profile.username,
    is_staff: profile.is_staff,
    memberships,
  });
}
