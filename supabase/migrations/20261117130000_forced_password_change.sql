alter table public.app_user
  add column must_change_password boolean not null default true;
