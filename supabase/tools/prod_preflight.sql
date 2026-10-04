select json_build_object(
 'version', version(),
 'current_user', current_user,
 'roles', (select json_agg(json_build_object('r',rolname,'super',rolsuper,'createrole',rolcreaterole,'bypassrls',rolbypassrls) order by rolname)
           from pg_roles where rolname in ('postgres','authenticator','anon','authenticated','service_role','supabase_auth_admin','supabase_admin','app_rpc_owner')),
 'postgres_member_of', (select json_agg(b.rolname) from pg_auth_members m join pg_roles b on b.oid=m.roleid join pg_roles u on u.oid=m.member where u.rolname='postgres'),
 'auth_users_triggers', (select json_agg(json_build_object('name',t.tgname,'enabled',t.tgenabled,'def',pg_get_triggerdef(t.oid)))
           from pg_trigger t where t.tgrelid='auth.users'::regclass and not t.tgisinternal),
 'funcs_touching_user_profiles', (select json_agg(json_build_object('fn',n.nspname||'.'||p.proname,'owner',pg_get_userbyid(p.proowner),'secdef',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text))
           from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname not in ('pg_catalog','information_schema') and p.prokind='f' and p.prosrc ilike '%user_profiles%'),
 'public_functions', (select json_agg(json_build_object('fn',p.proname,'owner',pg_get_userbyid(p.proowner),'secdef',p.prosecdef,'config',p.proconfig))
           from pg_proc p where p.pronamespace='public'::regnamespace),
 'auth_uid', (select json_agg(json_build_object('fn',p.proname,'owner',pg_get_userbyid(p.proowner),'secdef',p.prosecdef,'acl',p.proacl::text))
           from pg_proc p where p.pronamespace='auth'::regnamespace and p.proname in ('uid','role','jwt')),
 'schemas', (select json_agg(json_build_object('n',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text)) from pg_namespace where nspname in ('public','auth','private','extensions')),
 'tables', (select json_agg(json_build_object('t',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text) order by c.relname)
           from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v','p')),
 'public_triggers', (select json_agg(json_build_object('tbl',tgrelid::regclass::text,'name',tgname)) from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace)),
 'policies', (select json_agg(json_build_object('t',tablename,'p',policyname,'perm',permissive,'roles',roles::text,'cmd',cmd,'qual',qual,'check',with_check)) from pg_policies where schemaname='public'),
 'user_profiles_cols', (select json_agg(column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'')) from information_schema.columns where table_schema='public' and table_name='user_profiles'),
 'goals_cols', (select json_agg(column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'')) from information_schema.columns where table_schema='public' and table_name='goals'),
 'constraints', (select json_agg(json_build_object('t',conrelid::regclass::text,'n',conname,'def',pg_get_constraintdef(oid))) from pg_constraint where connamespace='public'::regnamespace),
 'indexes', (select json_agg(indexdef) from pg_indexes where schemaname='public'),
 'extensions', (select json_agg(extname||' '||extversion||' @'||extnamespace::regnamespace::text) from pg_extension),
 'v2_present', json_build_object('private', exists(select 1 from pg_namespace where nspname='private'), 'app_rpc_owner', exists(select 1 from pg_roles where rolname='app_rpc_owner'),
           'ledger', to_regclass('public.savings_transactions') is not null),
 'counts', json_build_object('auth_users',(select count(*) from auth.users),'profiles',(select count(*) from public.user_profiles),
           'users_without_profile',(select count(*) from auth.users u where not exists(select 1 from public.user_profiles p where p.id=u.id)),
           'profiles_without_user',(select count(*) from public.user_profiles p where not exists(select 1 from auth.users u where u.id=p.id))),
 'migrations_table', to_regclass('supabase_migrations.schema_migrations') is not null
) as preflight;
