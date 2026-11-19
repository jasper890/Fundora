import "server-only";
import { sql } from "../db";
import type { AppUser, AwardListView, AwardView, MemberView, Role } from "../types";

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
): Promise<AwardListView[]> {
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
      ru.username as recipient_username,
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
    join app_user ru on ru.id = rm.user_id
    left join lateral (
      select revision, digest from evidence_version
      where award_id = a.id and purged_at is null
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
    recipient_username: string;
    latest_revision: number | null;
    latest_digest: string | null;
    unresolved: boolean;
  }[];

  return rows.map((row) => ({
    id: row.id,
    program_id: row.program_id,
    recipient_username: row.recipient_username,
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

/** Roles the user currently holds on this award, under the same rules as the visibility query. */
export function myRoles(
  award: {
    sponsor_member: { user_id: string; role?: string; active?: boolean };
    verifier_member: { user_id: string; role?: string; active?: boolean };
    recipient_member: { user_id: string; role?: string; active?: boolean };
    verifier_sync_required?: boolean;
  },
  userId: string,
): Role[] {
  return (["SPONSOR", "VERIFIER", "RECIPIENT"] as const).filter((role) => {
    const member = award[`${role.toLowerCase() as "sponsor" | "verifier" | "recipient"}_member`];
    return (
      member.user_id === userId &&
      member.role === role &&
      member.active === true &&
      !(role === "VERIFIER" && award.verifier_sync_required)
    );
  });
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

export type AwardMobileContext = {
  deadlines: { claim: string; review: string; payout: string };
  my_open_operation: boolean;
  changes_requested: boolean;
};

/**
 * What the mobile next step needs beyond AwardListView, per award: program deadlines, whether this user owns an
 * unfinished chain operation, and whether the verifier requested changes on the latest evidence revision.
 */
export async function loadAwardMobileContext(
  awardIds: string[],
  userId: string,
): Promise<Map<string, AwardMobileContext>> {
  if (awardIds.length === 0) return new Map();
  const db = sql();
  const rows = (await db`
    select a.id, p.claim_deadline, p.review_deadline, p.payout_deadline,
      exists(
        select 1 from chain_operation co
        where co.award_id = a.id and co.actor_id = ${userId}
          and co.status in ('BUILDING','PREPARED','SIGNED','SUBMITTED','UNKNOWN')
      ) as my_open,
      exists(
        select 1 from review_action ra
        join evidence_version ev on ev.id = ra.evidence_id
        where ra.award_id = a.id and ra.action = 'REQUEST_CHANGES'
          and ev.revision = (
            select max(e2.revision) from evidence_version e2 where e2.award_id = a.id and e2.purged_at is null
          )
      ) as changes_requested
    from award a
    join program p on p.id = a.program_id
    where a.id in ${db(awardIds)}
  `) as unknown as { id: string; claim_deadline: Date; review_deadline: Date; payout_deadline: Date; my_open: boolean; changes_requested: boolean }[];
  return new Map(rows.map((row) => [row.id, {
    deadlines: {
      claim: new Date(row.claim_deadline).toISOString(),
      review: new Date(row.review_deadline).toISOString(),
      payout: new Date(row.payout_deadline).toISOString(),
    },
    my_open_operation: row.my_open,
    changes_requested: row.changes_requested,
  }]));
}

export type ReviewNote = {
  id: string;
  kind: "REQUEST_CHANGES" | "DISPUTE";
  note: string;
  source_check: string;
  evidence_revision: number;
  author_username: string;
  created_at: string;
};

/** Change requests and disputes on an award, newest first, for the award's own active members only. */
export async function loadReviewNotesForUser(awardId: string, user: AppUser): Promise<ReviewNote[]> {
  if (!user.is_active) return [];
  const db = sql();
  const rows = (await db`
    select ra.id, ra.action, ra.rationale, ra.source_check_method, ra.created_at,
      ev.revision as evidence_revision, u.username as author_username
    from review_action ra
    join evidence_version ev on ev.id = ra.evidence_id
    join app_user u on u.id = ra.verifier_id
    join award a on a.id = ra.award_id
    join program_member sm on sm.id = a.sponsor_member_id
    join program_member vm on vm.id = a.verifier_member_id
    join program_member rm on rm.id = a.recipient_member_id
    where ra.award_id = ${awardId}
      and ra.action in ('REQUEST_CHANGES', 'DISPUTE')
      and (
        (sm.user_id = ${user.id} and sm.role = 'SPONSOR' and sm.active)
        or (vm.user_id = ${user.id} and vm.role = 'VERIFIER' and vm.active and a.verifier_sync_required = false)
        or (rm.user_id = ${user.id} and rm.role = 'RECIPIENT' and rm.active)
      )
    order by ra.created_at desc, ra.id
  `) as unknown as {
    id: string;
    action: ReviewNote["kind"];
    rationale: string;
    source_check_method: string;
    created_at: Date | string;
    evidence_revision: number;
    author_username: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    kind: row.action,
    note: row.rationale,
    source_check: row.source_check_method,
    evidence_revision: Number(row.evidence_revision),
    author_username: row.author_username,
    created_at: new Date(row.created_at).toISOString(),
  }));
}
