select json_build_object(
 'app_rpc_owner', (select json_build_object('super',rolsuper,'bypassrls',rolbypassrls,'login',rolcanlogin,'inherit',rolinherit,'createrole',rolcreaterole) from pg_roles where rolname='app_rpc_owner'),
 'owner_member_of', (select json_agg(b.rolname) from pg_auth_members m join pg_roles b on b.oid=m.roleid join pg_roles u on u.oid=m.member where u.rolname='app_rpc_owner'),
 'members_of_owner', (select json_agg(u.rolname) from pg_auth_members m join pg_roles b on b.oid=m.roleid join pg_roles u on u.oid=m.member where b.rolname='app_rpc_owner'),
 'owner_usage_auth', has_schema_privilege('app_rpc_owner','auth','USAGE'),
 'owner_exec_uid', has_function_privilege('app_rpc_owner','auth.uid()','EXECUTE'),
 'owner_create_public', has_schema_privilege('app_rpc_owner','public','CREATE'),
 'rpcs', (select json_agg(json_build_object('fn',p.proname,'owner',pg_get_userbyid(p.proowner),'secdef',p.prosecdef,'cfg',p.proconfig,'acl',p.proacl::text) order by p.proname)
          from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('start_onboarding','complete_onboarding','record_prompt_impression','record_daily_decision',
          'record_extra_saving','amend_decision_amount','void_decision','use_grace_day','transfer_between_buckets','create_goal','update_goal','set_primary_goal','archive_goal','reactivate_goal','delete_goal')),
 'private_funcs', (select json_agg(json_build_object('fn',p.proname,'owner',pg_get_userbyid(p.proowner),'secdef',p.prosecdef,'cfg',p.proconfig,'acl',p.proacl::text)) from pg_proc p where p.pronamespace='private'::regnamespace),
 'private_schema', (select json_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl::text) from pg_namespace where nspname='private'),
 'v2_tables', (select json_agg(json_build_object('t',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl::text) order by c.relname)
          from pg_class c where c.relnamespace='public'::regnamespace and c.relname in ('onboarding_sessions','avatar_assessments','avatar_assessment_answers','income_declarations','goal_events',
          'daily_prompt_impressions','daily_decisions','savings_transactions','user_free_text','cat_income_bands','cat_recommendation_rules','cat_daily_questions','v_goal_state','v_hucha_balance','goals','user_profiles')),
 'views_options', (select json_agg(json_build_object('v',relname,'opts',reloptions)) from pg_class where relname in ('v_goal_state','v_hucha_balance') and relnamespace='public'::regnamespace),
 'v2_triggers', (select json_agg(json_build_object('tbl',tgrelid::regclass::text,'name',tgname,'enabled',tgenabled)) from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace)),
 'v2_policies', (select json_agg(json_build_object('t',tablename,'p',policyname,'perm',permissive,'roles',roles::text,'cmd',cmd)) from pg_policies where schemaname='public'),
 'catalog_counts', json_build_object('bands',(select count(*) from public.cat_income_bands),'rules',(select count(*) from public.cat_recommendation_rules),'questions',(select count(*) from public.cat_daily_questions)),
 'secdef_without_search_path', (select json_agg(n.nspname||'.'||p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where p.prosecdef and n.nspname in ('public','private') and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')),
 'anon_exec_any_v2', (select json_agg(p.proname) from pg_proc p where p.pronamespace in ('public'::regnamespace,'private'::regnamespace) and pg_get_userbyid(p.proowner)='app_rpc_owner' and has_function_privilege('anon',p.oid,'EXECUTE')),
 'service_exec_any_v2', (select json_agg(p.proname) from pg_proc p where p.pronamespace in ('public'::regnamespace,'private'::regnamespace) and pg_get_userbyid(p.proowner)='app_rpc_owner' and has_function_privilege('service_role',p.oid,'EXECUTE')),
 'auth_exec_private', (select json_agg(p.proname) from pg_proc p where p.pronamespace='private'::regnamespace and has_function_privilege('authenticated',p.oid,'EXECUTE')),
 'authenticated_write_ledger', json_build_object('ins',has_table_privilege('authenticated','public.savings_transactions','INSERT'),'upd',has_table_privilege('authenticated','public.savings_transactions','UPDATE'),
          'del',has_table_privilege('authenticated','public.savings_transactions','DELETE'),'trunc',has_table_privilege('authenticated','public.savings_transactions','TRUNCATE'))
) as v2check;
