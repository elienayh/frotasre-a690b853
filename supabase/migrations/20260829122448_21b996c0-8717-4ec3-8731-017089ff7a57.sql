ALTER TABLE public.trip_occupants
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES public.profiles(id);

CREATE OR REPLACE FUNCTION public.can_manage_occupants(_trip_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'super_admin')
      OR public.is_sre_driver(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.trip_requests t
        WHERE t.id = _trip_id
          AND (t.requester_id = _user_id OR t.assigned_driver_user_id = _user_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.trip_requests t
        JOIN public.profiles req ON req.id = t.requester_id
        JOIN public.profiles coord ON coord.id = _user_id
        WHERE t.id = _trip_id
          AND coord.is_coordinator
          AND coord.sector IS NOT NULL
          AND coord.sector = req.sector
      )
$function$;

CREATE OR REPLACE FUNCTION public.log_occupant_removal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  IF NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL THEN
    v_name := COALESCE(NEW.external_name, (SELECT full_name FROM public.profiles WHERE id = NEW.user_id), 'Ocupante');
    INSERT INTO public.trip_history (trip_id, actor_id, action, details)
    VALUES (NEW.trip_id, COALESCE(NEW.removed_by, auth.uid()), 'OCUPANTE_REMOVIDO', 'Passageiro removido da lista: ' || v_name);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_occupant_removal ON public.trip_occupants;
CREATE TRIGGER trg_log_occupant_removal
AFTER UPDATE ON public.trip_occupants
FOR EACH ROW EXECUTE FUNCTION public.log_occupant_removal();