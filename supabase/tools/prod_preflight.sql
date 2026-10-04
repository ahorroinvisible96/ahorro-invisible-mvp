-- 5B.2.5 · PREFLIGHT DE SOLO LECTURA para producción/staging Supabase.
-- Pegar en Dashboard → SQL Editor (o psql). NO modifica nada. Devolver el resultado completo.

-- 1) Versión y rol actual
select version();
select current_user, rolsuper, rolcreaterole, rolbypassrls from pg_roles where rolname = current_user;
select rolname, rolsuper, rolcreaterole, rolbypassrls from pg_roles
 where rolname in ('postgres','authenticator','anon','authenticated','service_role','supabase_auth_admin','app_rpc_owner');

-- 2) Triggers sobre auth.users (auth → user_profiles)
select t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as def
  from pg_trigger t where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;

-- 3) Funciones que escriben en user_profiles: owner, SECURITY DEFINER, search_path, grants
select n.nspname, p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proconfig, p.proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where pg_get_functiondef(p.oid) ilike '%user_profiles%' and n.nspname in ('public','auth','private');

-- 4) auth.uid(): existencia y grants; schema auth
select p.proname, pg_get_userbyid(p.proowner) owner, p.prosecdef, p.proacl from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and p.proname in ('uid','role','jwt');
select nspname, pg_get_userbyid(nspowner) owner, nspacl from pg_namespace where nspname in ('auth','public','private');

-- 5) Tablas V1 existentes, owner, RLS y políticas
select c.relname, pg_get_userbyid(c.relowner) owner, c.relrowsecurity rls, c.relforcerowsecurity force_rls, c.relacl
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' order by 1;
select tablename, policyname, permissive, roles, cmd, qual, with_check from pg_policies where schemaname='public' order by 1,2;

-- 6) Triggers V1 en public
select event_object_table, trigger_name, action_timing, event_manipulation from information_schema.triggers
 where trigger_schema='public' order by 1,2;

-- 7) Migraciones V2 ya presentes (esperado: ninguna)
select to_regclass('public.savings_transactions') as ledger, to_regclass('public.cat_income_bands') as cat,
       to_regprocedure('public.record_extra_saving(uuid,timestamptz,text,numeric,text,text,text)') as rpc;
select exists(select 1 from pg_namespace where nspname='private') as private_schema,
       exists(select 1 from pg_roles where rolname='app_rpc_owner') as rpc_owner;

-- 8) Extensiones y default privileges
select extname, extversion from pg_extension order by 1;
select pg_get_userbyid(defaclrole) as role, defaclnamespace::regnamespace, defaclobjtype, defaclacl from pg_default_acl;

-- 9) Inferencia auth→profile: usuarios sin perfil (esperado 0 si el trigger/flujo los crea)
select (select count(*) from auth.users) users, (select count(*) from public.user_profiles) profiles,
       (select count(*) from auth.users u where not exists (select 1 from public.user_profiles p where p.user_id=u.id)) users_without_profile;
