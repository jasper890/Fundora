import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeading } from "@/components/PageHeading";
import { Notice } from "@/components/Notice";
import { requireSessionUser } from "@/lib/session";
import { sql } from "@/lib/db";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  let ops: { action: string; status: string; created_at: string }[] = [];
  try {
    const db = sql();
    ops = (await db`
      select action, status, created_at
      from chain_operation
      where award_id = ${id}
      order by created_at desc
      limit 50
    `) as unknown as typeof ops;
  } catch {
    /* db down */
  }

  return (
    <AppShell username={user.username}>
      <p className="lead">
        <Link href={`/awards/${id}`}>← Award</Link>
      </p>
      <PageHeading
        title="Award activity"
        lead="Public operation history only. Private evidence is never listed here."
      />
      {ops.length === 0 ? (
        <Notice>No chain operations recorded yet.</Notice>
      ) : (
        <ul>
          {ops.map((op, index) => (
            <li key={`${op.action}-${index}`}>
              {op.action} · {op.status} · {new Date(op.created_at).toISOString()}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
