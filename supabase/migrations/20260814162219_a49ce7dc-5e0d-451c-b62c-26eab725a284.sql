REVOKE ALL ON FUNCTION public.push_notification(uuid, text, text, text, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trip_label(public.trip_requests) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vehicle_label(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.person_label(uuid) FROM PUBLIC, anon;