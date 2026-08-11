
REVOKE EXECUTE ON FUNCTION public.schedule_conflicts(uuid,uuid,uuid,timestamptz,timestamptz,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.suggest_free_slot(uuid,uuid,uuid,timestamptz,timestamptz,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_users(uuid[],text,text,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_sre_driver(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_schedule_driver(uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.schedule_conflicts(uuid,uuid,uuid,timestamptz,timestamptz,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.suggest_free_slot(uuid,uuid,uuid,timestamptz,timestamptz,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_users(uuid[],text,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_sre_driver(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_schedule_driver(uuid,uuid) TO authenticated, service_role;
