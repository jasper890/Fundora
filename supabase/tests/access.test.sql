begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(7);

select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname in
    ('app_user','program','program_member','award','login_attempt','evidence_version','evidence_file','review_action','chain_operation','chain_observation','evidence_upload_reservation')
    and not c.relrowsecurity
), 'RLS protects every application table');
select is((select public from storage.buckets where id = 'evidence'), false, 'Evidence bucket is private');
select is((select count(*) from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE'), 0::bigint, 'No permissive public-table policies bypass server authorization');
select ok(exists (select 1 from pg_indexes where indexname = 'chain_unresolved_signer_unique' and indexdef like '%UNIQUE%'), 'An unresolved operation reserves its signer atomically');
select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'app_user' and column_name = 'must_change_password'), 'true', 'Provisioned accounts must change their password by default');

set local role authenticated;
select is_empty('select id from public.award', 'Authenticated browser cannot enumerate awards directly');
select is_empty('select id from public.evidence_file', 'Authenticated browser cannot enumerate private evidence directly');
reset role;
select * from finish();
rollback;
