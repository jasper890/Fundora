import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { PageHeading } from "@/components/PageHeading";
import { CreateAwardForm } from "@/components/CreateAwardForm";
import { requireSessionUser } from "@/lib/session";
import { sql } from "@/lib/db";

export default async function CreateAwardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

  let recipients: { id: string; username: string }[] = [];
  let allowed = false;
  try {
    const db = sql();
    const program = (await db`
      select sponsor_user_id from program where id = ${id} limit 1
    `) as unknown as { sponsor_user_id: string }[];
    if (program[0]) {
      allowed = program[0].sponsor_user_id === user.id || user.is_staff;
    }
    recipients = (await db`
      select u.id, u.username
      from app_user u
      where u.is_active = true
        and not exists (
          select 1 from program_member pm
          join award a on a.recipient_member_id = pm.id
          where pm.program_id = ${id}
            and pm.user_id = u.id
            and pm.role = 'RECIPIENT'
        )
      order by u.username
      limit 50
    `) as unknown as { id: string; username: string }[];
  } catch {
    return (
      <AppShell username={user.username} roleLabel="SPONSOR">
        <Notice>Database unavailable.</Notice>
      </AppShell>
    );
  }

  if (!allowed) {
    return (
      <AppShell username={user.username}>
        <Notice>Only the program sponsor can create awards.</Notice>
      </AppShell>
    );
  }

  return (
    <AppShell username={user.username} roleLabel="SPONSOR">
      <p className="lead">
        <Link href="/programs">← Projects</Link>
      </p>
      <PageHeading
        title="Create participant award"
        lead="Terms are immutable after creation: fixed 20 Testnet XLM, program deadlines, distinct wallets."
      />
      <CreateAwardForm programId={id} recipients={recipients} />
    </AppShell>
  );
}
