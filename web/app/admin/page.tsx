import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeading } from "@/components/PageHeading";
import { Notice } from "@/components/Notice";
import { requireSessionUser } from "@/lib/session";
import { sql } from "@/lib/db";

export default async function AdminHomePage() {
  const user = await requireSessionUser();
  if (!user.is_staff) redirect("/forbidden");

  let users: { username: string; is_staff: boolean; is_active: boolean }[] = [];
  let programs: { id: string; title: string }[] = [];
  try {
    const db = sql();
    users = (await db`
      select username, is_staff, is_active from app_user
      order by username limit 100
    `) as unknown as typeof users;
    programs = (await db`
      select id, title from program order by created_at desc limit 50
    `) as unknown as typeof programs;
  } catch {
    return (
      <AppShell username={user.username} roleLabel="ADMIN" isStaff>
        <Notice>Database unavailable.</Notice>
      </AppShell>
    );
  }

  return (
    <AppShell username={user.username} roleLabel="ADMIN" isStaff>
      <PageHeading
        title="Administrator workspace"
        lead="Provision members and manage program access. No payment authority and no automatic evidence access."
      />
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Programs</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {programs.map((p) => (
            <li key={p.id} style={{ padding: "0.5rem 0" }}>
              <Link href={`/admin/programs/${p.id}`}>{p.title}</Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 style={{ fontSize: "1.05rem" }}>Users</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {users.map((u) => (
            <li key={u.username} style={{ padding: "0.35rem 0" }}>
              {u.username}
              {u.is_staff ? " · staff" : ""}
              {!u.is_active ? " · inactive" : ""}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
