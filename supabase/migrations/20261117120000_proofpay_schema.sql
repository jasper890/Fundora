-- ProofPay schema ported from proofpay/models.py
-- RLS enabled with no policies for anon/authenticated (deny all).

create extension if not exists "pgcrypto";

create table public.app_user (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  is_staff boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.program (
  id uuid primary key default gen_random_uuid(),
  title varchar(160) not null,
  requirements_text text not null,
  requirements_version integer not null default 1 check (requirements_version > 0),
  sponsor_user_id uuid not null references public.app_user (id),
  verifier_user_id uuid not null references public.app_user (id),
  claim_deadline timestamptz not null,
  review_deadline timestamptz not null,
  payout_deadline timestamptz not null,
  created_at timestamptz not null default now(),
  constraint program_deadlines_ordered check (
    claim_deadline < review_deadline and review_deadline < payout_deadline
  )
);

create table public.program_member (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.program (id),
  user_id uuid not null references public.app_user (id),
  role text not null check (role in ('SPONSOR', 'VERIFIER', 'RECIPIENT')),
  public_wallet varchar(56) not null,
  active boolean not null default true,
  constraint member_unique_user_per_program unique (program_id, user_id),
  constraint member_unique_wallet_per_program unique (program_id, public_wallet)
);

create table public.award (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.program (id),
  sponsor_member_id uuid not null references public.program_member (id),
  verifier_member_id uuid not null references public.program_member (id),
  recipient_member_id uuid not null references public.program_member (id),
  contract_id varchar(56) unique,
  network_id varchar(128) not null default '',
  code_hash varchar(64) not null default '',
  token_id varchar(56) not null default '',
  base_units bigint not null default 200000000 check (base_units = 200000000),
  status text not null default 'CREATED' check (
    status in (
      'CREATED', 'FUNDED', 'SUBMITTED', 'APPROVED', 'REJECTED',
      'PAID', 'REFUNDED', 'CANCELLED'
    )
  ),
  version bigint not null default 0,
  settled_at timestamptz,
  deployment_error varchar(48) not null default '',
  verifier_sync_required boolean not null default false,
  deployment_manifest jsonb not null default '{}'::jsonb,
  sponsor_hold boolean not null default false,
  verifier_hold boolean not null default false,
  evidence_revision integer not null default 0,
  evidence_digest varchar(64) not null default '',
  last_confirmed_ledger bigint,
  created_at timestamptz not null default now(),
  constraint award_unique_recipient_per_program unique (program_id, recipient_member_id),
  constraint award_distinct_role_members check (
    sponsor_member_id <> verifier_member_id
    and sponsor_member_id <> recipient_member_id
    and verifier_member_id <> recipient_member_id
  )
);

create table public.login_attempt (
  account_ip_digest varchar(64) primary key,
  window_started_at timestamptz not null,
  failed_attempts smallint not null default 0,
  last_attempt_at timestamptz not null,
  last_succeeded boolean not null default false
);
create index login_last_attempt_idx on public.login_attempt (last_attempt_at);

create table public.evidence_version (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.award (id),
  revision integer not null check (revision > 0),
  purged_at timestamptz,
  nonce varchar(64) not null,
  manifest text not null,
  digest varchar(64) not null,
  explanation text not null,
  source_ref varchar(512) not null,
  author_id uuid not null references public.app_user (id),
  created_at timestamptz not null default now(),
  constraint evidence_unique_revision unique (award_id, revision)
);

create table public.evidence_file (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.evidence_version (id),
  storage_name varchar(80) not null unique,
  filename varchar(160) not null,
  content_type varchar(32) not null,
  size integer not null check (size > 0),
  digest varchar(64) not null
);

create table public.review_action (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.award (id),
  evidence_id uuid not null references public.evidence_version (id),
  verifier_id uuid not null references public.app_user (id),
  action text not null check (
    action in ('APPROVE', 'REJECT', 'REOPEN', 'REQUEST_CHANGES', 'DISPUTE')
  ),
  rationale text not null,
  source_check_method varchar(512) not null default '',
  source_confirmed boolean not null default false,
  expected_version bigint not null,
  status varchar(12) not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table public.chain_operation (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.award (id),
  actor_id uuid not null references public.app_user (id),
  signer varchar(56) not null,
  reserves_source boolean not null default true,
  action varchar(20) not null,
  idempotency_key uuid not null,
  intent jsonb not null,
  status varchar(24) not null default 'BUILDING',
  unsigned_xdr text not null default '',
  unsigned_hash varchar(64) not null default '',
  signed_xdr text not null default '',
  signed_hash varchar(64) unique,
  preview jsonb not null default '{}'::jsonb,
  expected_snapshot jsonb not null default '{}'::jsonb,
  review_id uuid unique references public.review_action (id),
  expires_at timestamptz not null,
  error_code varchar(48) not null default '',
  confirmed_ledger bigint,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chain_actor_idempotency_unique unique (actor_id, idempotency_key)
);

-- Partial unique: one unresolved reserved signer at a time
create unique index chain_unresolved_signer_unique
  on public.chain_operation (signer)
  where reserves_source = true
    and status in ('BUILDING', 'PREPARED', 'SIGNED', 'SUBMITTED', 'UNKNOWN');

create table public.chain_observation (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.chain_operation (id),
  status varchar(24) not null,
  code varchar(48) not null default '',
  ledger bigint,
  created_at timestamptz not null default now()
);

-- Evidence upload reservations (begin/finalize)
create table public.evidence_upload_reservation (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.award (id),
  author_id uuid not null references public.app_user (id),
  expected_revision integer not null,
  explanation text not null,
  source_ref varchar(512) not null,
  object_paths text[] not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

alter table public.app_user enable row level security;
alter table public.program enable row level security;
alter table public.program_member enable row level security;
alter table public.award enable row level security;
alter table public.login_attempt enable row level security;
alter table public.evidence_version enable row level security;
alter table public.evidence_file enable row level security;
alter table public.review_action enable row level security;
alter table public.chain_operation enable row level security;
alter table public.chain_observation enable row level security;
alter table public.evidence_upload_reservation enable row level security;

-- Private evidence bucket when the storage schema exists (Supabase).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'evidence',
      'evidence',
      false,
      5242880,
      array['application/pdf', 'image/png', 'image/jpeg']
    )
    on conflict (id) do nothing;
  end if;
end $$;
