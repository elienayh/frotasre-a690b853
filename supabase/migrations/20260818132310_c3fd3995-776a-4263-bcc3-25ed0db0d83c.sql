-- Correção de segurança para a função handle_stop_driver_notification
ALTER FUNCTION public.handle_stop_driver_notification() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_stop_driver_notification() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_stop_driver_notification() TO service_role;
