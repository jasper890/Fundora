import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeading } from "@/components/PageHeading";
import { EmptyState } from "@/components/EmptyState";
import { Notice } from "@/components/Notice";
import { requireSessionUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { AdminUserForm } from "@/components/AdminUserForm";

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
        lead="Provision members and manage project access. No payment authority and no automatic evidence access."
      />
      <AdminUserForm />
      <section className="home-panel" aria-labelledby="admin-projects">
        <span className="eyebrow">Access</span>
        <h2 id="admin-projects">Projects</h2>
        {programs.length === 0 ? (
          <EmptyState
            title="No projects yet"
            body="Projects appear here once a sponsor creates one. Then add members to it."
          />
        ) : (
          <ul className="home-register-list">
            {programs.map((p) => (
              <li key={p.id} className="home-award-row">
                <div className="home-award-main">
                  <div className="home-award-title">{p.title}</div>
                </div>
                <Link className="button secondary" href={`/admin/programs/${p.id}`}>
                  Manage members
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="home-panel" aria-labelledby="admin-users">
        <span className="eyebrow">Accounts</span>
        <h2 id="admin-users">Users</h2>
        <ul className="home-register-list">
          {users.map((u) => (
            <li key={u.username} className="home-award-row">
              <div className="home-award-main">
                <div className="home-award-title">{u.username}</div>
                <p className="home-award-meta">
                  {u.is_staff ? "Administrator" : "Member"}
                  {!u.is_active ? " · inactive" : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
