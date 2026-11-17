import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeading } from "@/components/PageHeading";
import { Notice } from "@/components/Notice";
import { requireSessionUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { isAwardVisible } from "@/lib/permissions";
import type { MemberView, Role } from "@/lib/types";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  let ops: {
    id: string;
    action: string;
    status: string;
    created_at: string;
    confirmed_ledger: number | null;
    error_code: string;
  }[] = [];

  try {
    const db = sql();
    const accessRows = (await db`
      select
        a.verifier_sync_required,
        sm.user_id as sponsor_user_id, sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
        vm.user_id as verifier_user_id, vm.active as verifier_active, vm.public_wallet as verifier_wallet,
        rm.user_id as recipient_user_id, rm.active as recipient_active, rm.public_wallet as recipient_wallet
      from award a
      join program_member sm on sm.id = a.sponsor_member_id
      join program_member vm on vm.id = a.verifier_member_id
      join program_member rm on rm.id = a.recipient_member_id
      where a.id = ${id}
      limit 1
    `) as unknown as Record<string, unknown>[];
    const access = accessRows[0];
    if (!access) notFound();
    const member = (
      userId: string,
      role: Role,
      active: boolean,
      wallet: string,
    ): MemberView => ({ user_id: userId, role, active, public_wallet: wallet });
    if (
      !user.is_staff &&
      !isAwardVisible(
        {
          sponsor_member: member(
            String(access.sponsor_user_id),
            "SPONSOR",
            Boolean(access.sponsor_active),
            String(access.sponsor_wallet),
          ),
          verifier_member: member(
            String(access.verifier_user_id),
            "VERIFIER",
            Boolean(access.verifier_active),
            String(access.verifier_wallet),
          ),
          recipient_member: member(
            String(access.recipient_user_id),
            "RECIPIENT",
            Boolean(access.recipient_active),
            String(access.recipient_wallet),
          ),
          verifier_sync_required: Boolean(access.verifier_sync_required),
        },
        user,
      )
    ) {
      notFound();
    }

    ops = (await db`
      select id, action, status, created_at, confirmed_ledger, error_code
      from chain_operation
      where award_id = ${id}
      order by created_at desc
      limit 50
    `) as unknown as typeof ops;
  } catch {
    return (
      <AppShell username={user.username} isStaff={user.is_staff}>
        <Notice>Database unavailable.</Notice>
      </AppShell>
    );
  }

  return (
    <AppShell username={user.username} isStaff={user.is_staff}>
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
        <ul style={{ listStyle: "none", padding: 0 }}>
          {ops.map((op) => (
            <li
              key={op.id}
              style={{
                padding: "0.75rem 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <strong>{op.action}</strong> · {op.status}
              {op.confirmed_ledger ? ` · ledger ${op.confirmed_ledger}` : ""}
              {op.error_code ? ` · ${op.error_code}` : ""}
              <div className="lead" style={{ margin: "0.25rem 0 0" }}>
                {new Date(op.created_at).toISOString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
