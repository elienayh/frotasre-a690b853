CREATE OR REPLACE FUNCTION public.sync_trip_drivers_to_occupants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id uuid;
  v_updated int;
BEGIN
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND OLD.driver_user_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR NEW.driver_user_id IS DISTINCT FROM OLD.driver_user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trip_stops
      WHERE trip_id = OLD.trip_id
        AND driver_user_id = OLD.driver_user_id
        AND id <> OLD.id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.trip_requests
      WHERE id = OLD.trip_id AND assigned_driver_user_id = OLD.driver_user_id
    ) THEN
      DELETE FROM public.trip_occupants
      WHERE trip_id = OLD.trip_id
        AND user_id = OLD.driver_user_id
        AND is_driver = TRUE;
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.driver_user_id IS NOT NULL THEN
    SELECT requester_id INTO v_requester_id FROM public.trip_requests WHERE id = NEW.trip_id;

    UPDATE public.trip_occupants
       SET is_driver = TRUE, status = 'CONFIRMADO'
     WHERE trip_id = NEW.trip_id AND user_id = NEW.driver_user_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
      INSERT INTO public.trip_occupants (trip_id, user_id, is_driver, added_by, status)
      VALUES (NEW.trip_id, NEW.driver_user_id, TRUE, v_requester_id, 'CONFIRMADO');
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_assigned_driver_to_occupants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF NEW.assigned_driver_user_id IS NOT DISTINCT FROM OLD.assigned_driver_user_id THEN
    RETURN NEW;
  END IF;

  IF OLD.assigned_driver_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.trip_stops
      WHERE trip_id = NEW.id AND driver_user_id = OLD.assigned_driver_user_id
    ) THEN
      NULL;
    ELSE
      DELETE FROM public.trip_occupants
      WHERE trip_id = NEW.id
        AND user_id = OLD.assigned_driver_user_id
        AND is_driver = TRUE;
    END IF;
  END IF;

  IF NEW.assigned_driver_user_id IS NOT NULL THEN
    UPDATE public.trip_occupants
       SET is_driver = TRUE, status = 'CONFIRMADO'
     WHERE trip_id = NEW.id AND user_id = NEW.assigned_driver_user_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
      INSERT INTO public.trip_occupants (trip_id, user_id, is_driver, added_by, status)
      VALUES (NEW.id, NEW.assigned_driver_user_id, TRUE, NEW.requester_id, 'CONFIRMADO');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_assigned_driver ON public.trip_requests;
CREATE TRIGGER trg_sync_assigned_driver
AFTER UPDATE OF assigned_driver_user_id ON public.trip_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_assigned_driver_to_occupants();