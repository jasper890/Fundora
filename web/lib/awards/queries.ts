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
  options: { allowMustChangePassword?: boolean } = {},
): Promise<AppUser | null> {
  const db = sql();
  const rows = (await db`
    select id, username, is_staff, is_active, must_change_password
    from app_user
    where id = ${authId}
    limit 1
  `) as unknown as AppUser[];
  const user = rows[0];
  if (!user?.is_active) return null;
  if (user.must_change_password && !options.allowMustChangePassword) return null;
  return user ?? null;
}

export async function listVisibleAwardsForUser(
  user: AppUser,
  programId?: string,
): Promise<AwardView[]> {
  const db = sql();
  const rows = (await db`
    select
      a.id,
      a.program_id,
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
    where (
      (sm.user_id = ${user.id} and sm.role = 'SPONSOR' and sm.active)
      or (vm.user_id = ${user.id} and vm.role = 'VERIFIER' and vm.active and a.verifier_sync_required = false)
      or (rm.user_id = ${user.id} and rm.role = 'RECIPIENT' and rm.active)
    )
      and (${programId ?? null}::uuid is null or a.program_id = ${programId ?? null}::uuid)
  `) as unknown as {
    id: string;
    program_id: string;
    status: AwardView["status"];
    last_confirmed_ledger: number | null;
    sponsor_hold: boolean;
    verifier_hold: boolean;
    evidence_revision: number;
    evidence_digest: string;
    verifier_sync_required: boolean;
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
    program_id: row.program_id,
    status: row.status,
    last_confirmed_ledger: row.last_confirmed_ledger,
    sponsor_hold: row.sponsor_hold,
    verifier_hold: row.verifier_hold,
    evidence_revision: row.evidence_revision,
    evidence_digest: row.evidence_digest,
    latest_evidence_revision: row.latest_revision,
    verifier_sync_required: row.verifier_sync_required,
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

export type EvidenceHistoryFile = {
  id: string;
  filename: string;
  content_type: string;
  size: number;
};

export type EvidenceHistoryItem = {
  id: string;
  revision: number;
  digest: string;
  explanation: string;
  source_ref: string;
  created_at: string;
  files: EvidenceHistoryFile[];
};

export async function loadEvidenceHistoryForUser(
  awardId: string,
  user: AppUser,
): Promise<EvidenceHistoryItem[]> {
  if (!user.is_active) return [];
  const db = sql();
  const rows = (await db`
    select
      ev.id,
      ev.revision,
      ev.digest,
      ev.explanation,
      ev.source_ref,
      ev.created_at,
      ef.id as file_id,
      ef.filename,
      ef.content_type,
      ef.size
    from evidence_version ev
    join award a on a.id = ev.award_id
    join program_member sm on sm.id = a.sponsor_member_id
    join program_member vm on vm.id = a.verifier_member_id
    join program_member rm on rm.id = a.recipient_member_id
    left join evidence_file ef on ef.version_id = ev.id
    where ev.award_id = ${awardId}
      and ev.purged_at is null
      and (
        (sm.user_id = ${user.id} and sm.role = 'SPONSOR' and sm.active)
        or (vm.user_id = ${user.id} and vm.role = 'VERIFIER' and vm.active and a.verifier_sync_required = false)
        or (rm.user_id = ${user.id} and rm.role = 'RECIPIENT' and rm.active)
      )
    order by ev.revision desc, ef.id
  `) as unknown as {
    id: string;
    revision: number;
    digest: string;
    explanation: string;
    source_ref: string;
    created_at: Date | string;
    file_id: string | null;
    filename: string | null;
    content_type: string | null;
    size: number | null;
  }[];

  const versions = new Map<string, EvidenceHistoryItem>();
  for (const row of rows) {
    let version = versions.get(row.id);
    if (!version) {
      version = {
        id: row.id,
        revision: Number(row.revision),
        digest: row.digest,
        explanation: row.explanation,
        source_ref: row.source_ref,
        created_at: new Date(row.created_at).toISOString(),
        files: [],
      };
      versions.set(row.id, version);
    }
    if (row.file_id && row.filename && row.content_type && row.size != null) {
      version.files.push({
        id: row.file_id,
        filename: row.filename,
        content_type: row.content_type,
        size: Number(row.size),
      });
    }
  }
  return [...versions.values()];
}
