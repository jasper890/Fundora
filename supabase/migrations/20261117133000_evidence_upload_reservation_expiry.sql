alter table public.evidence_upload_reservation
  add column if not exists expires_at timestamptz;

update public.evidence_upload_reservation
set expires_at = created_at + interval '15 minutes'
where expires_at is null;

alter table public.evidence_upload_reservation
  alter column expires_at set default (now() + interval '15 minutes');

alter table public.evidence_upload_reservation
  alter column expires_at set not null;
