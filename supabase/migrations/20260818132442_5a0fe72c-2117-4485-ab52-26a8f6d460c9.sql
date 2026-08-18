-- Ajuste de segurança para sync_trip_drivers_to_occupants
REVOKE EXECUTE ON FUNCTION public.sync_trip_drivers_to_occupants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_trip_drivers_to_occupants() TO service_role;
