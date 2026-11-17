import "server-only";
import { sql } from "../db";
import type { AppUser, AwardView, MemberView, Role } from "../types";

type MemberRow = {
  id: string;
  user_id: string;
  role: Role;
  active: boolean;
  public_wallet: string;
};

function toMember(row: MemberRow): MemberView {
  return {
    user_id: row.user_id,
    role: row.role,
    active: row.active,
    public_wallet: row.public_wallet,
  };
}

export async function loadAppUserByAuthId(
  authId: string,
): Promise<AppUser | null> {
  const db = sql();
  const rows = (await db`
    select id, username, is_staff, is_active
    from app_user
    where id = ${authId}
    limit 1
  `) as unknown as AppUser[];
  return rows[0] ?? null;
}

export async function listVisibleAwardsForUser(
  user: AppUser,
): Promise<AwardView[]> {
  const db = sql();
  const rows = (await db`
    select
      a.id,
      a.status,
      a.last_confirmed_ledger,
      a.sponsor_hold,
      a.verifier_hold,
      a.evidence_revision,
      a.evidence_digest,
      a.verifier_sync_required,
      sm.user_id as sponsor_user_id,
      sm.role as sponsor_role,
      sm.active as sponsor_active,
      sm.public_wallet as sponsor_wallet,
      vm.user_id as verifier_user_id,
      vm.role as verifier_role,
      vm.active as verifier_active,
      vm.public_wallet as verifier_wallet,
      rm.user_id as recipient_user_id,
      rm.role as recipient_role,
      rm.active as recipient_active,
      rm.public_wallet as recipient_wallet,
      ev.revision as latest_revision,
      ev.digest as latest_digest,
      exists(
        select 1 from chain_operation co
        where co.award_id = a.id
          and co.status in ('BUILDING','PREPARED','SIGNED','SUBMITTED','UNKNOWN')
      ) as unresolved
    from award a
    join program_member sm on sm.id = a.sponsor_member_id
    join program_member vm on vm.id = a.verifier_member_id
    join program_member rm on rm.id = a.recipient_member_id
    left join lateral (
      select revision, digest from evidence_version
      where award_id = a.id
      order by revision desc
      limit 1
    ) ev on true
    where
      (sm.user_id = ${user.id} and sm.role = 'SPONSOR' and sm.active)
      or (vm.user_id = ${user.id} and vm.role = 'VERIFIER' and vm.active and a.verifier_sync_required = false)
      or (rm.user_id = ${user.id} and rm.role = 'RECIPIENT' and rm.active)
  `) as unknown as {
    id: string;
    status: AwardView["status"];
    last_confirmed_ledger: number | null;
    sponsor_hold: boolean;
    verifier_hold: boolean;
    evidence_revision: number;
    evidence_digest: string;
    sponsor_user_id: string;
    sponsor_role: Role;
    sponsor_active: boolean;
    sponsor_wallet: string;
    verifier_user_id: string;
    verifier_role: Role;
    verifier_active: boolean;
    verifier_wallet: string;
    recipient_user_id: string;
    recipient_role: Role;
    recipient_active: boolean;
    recipient_wallet: string;
    latest_revision: number | null;
    latest_digest: string | null;
    unresolved: boolean;
  }[];

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    last_confirmed_ledger: row.last_confirmed_ledger,
    sponsor_hold: row.sponsor_hold,
    verifier_hold: row.verifier_hold,
    evidence_revision: row.evidence_revision,
    evidence_digest: row.evidence_digest,
    sponsor_member: toMember({
      id: "",
      user_id: row.sponsor_user_id,
      role: row.sponsor_role,
      active: row.sponsor_active,
      public_wallet: row.sponsor_wallet,
    }),
    verifier_member: toMember({
      id: "",
      user_id: row.verifier_user_id,
      role: row.verifier_role,
      active: row.verifier_active,
      public_wallet: row.verifier_wallet,
    }),
    recipient_member: toMember({
      id: "",
      user_id: row.recipient_user_id,
      role: row.recipient_role,
      active: row.recipient_active,
      public_wallet: row.recipient_wallet,
    }),
    latest_evidence:
      row.latest_revision == null || row.latest_digest == null
        ? null
        : { revision: row.latest_revision, digest: row.latest_digest },
    unresolved_operation: row.unresolved,
  }));
}
