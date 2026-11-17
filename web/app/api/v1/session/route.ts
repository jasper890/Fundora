import { jsonOk } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sql } from "@/lib/db";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonOk({ authenticated: false });
  }
  const profile = await loadAppUserByAuthId(user.id);
  if (!profile) {
    return jsonOk({ authenticated: false });
  }
  const db = sql();
  const memberships = (await db`
    select pm.program_id, pm.role, p.title
    from program_member pm
    join program p on p.id = pm.program_id
    where pm.user_id = ${profile.id} and pm.active = true
  `) as unknown as { program_id: string; role: string; title: string }[];
  return jsonOk({
    authenticated: true,
    username: profile.username,
    is_staff: profile.is_staff,
    memberships,
  });
}
