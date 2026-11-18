import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeading } from "@/components/PageHeading";
import { Notice } from "@/components/Notice";
import { requireSessionUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { AdminMemberForm } from "@/components/AdminMemberForm";

export default async function AdminProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  if (!user.is_staff) redirect("/forbidden");
  const { id } = await params;

  let title = "";
  let members: { username: string; role: string; public_wallet: string; active: boolean }[] =
    [];
  let users: { id: string; username: string }[] = [];
  try {
    const db = sql();
    const programs = (await db`
      select title from program where id = ${id} limit 1
    `) as unknown as { title: string }[];
    if (!programs[0]) notFound();
    title = programs[0].title;
    members = (await db`
      select u.username, pm.role, pm.public_wallet, pm.active
      from program_member pm
      join app_user u on u.id = pm.user_id
      where pm.program_id = ${id}
      order by pm.role, u.username
    `) as unknown as typeof members;
    users = (await db`
      select id, username from app_user where is_active = true order by username
    `) as unknown as typeof users;
  } catch {
    return (
      <AppShell username={user.username} roleLabel="ADMIN" isStaff>
        <Notice>Database unavailable.</Notice>
      </AppShell>
    );
  }

  return (
    <AppShell username={user.username} roleLabel="ADMIN" isStaff>
      <p className="lead">
        <Link href="/admin">← Admin</Link>
      </p>
      <PageHeading title={title} lead="Project membership (no evidence access here)." />
      <ul style={{ listStyle: "none", padding: 0 }}>
        {members.map((m) => (
          <li key={`${m.username}-${m.role}`} style={{ padding: "0.4rem 0" }}>
            {m.role} · {m.username} · {m.public_wallet.slice(0, 8)}…
            {!m.active ? " · inactive" : ""}
          </li>
        ))}
      </ul>
      <AdminMemberForm programId={id} users={users} />
    </AppShell>
  );
}
