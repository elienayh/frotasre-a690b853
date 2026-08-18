-- Notificação quando um motorista é definido em uma parada
CREATE OR REPLACE FUNCTION public.handle_stop_driver_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_trip_id uuid;
  v_departure_at timestamptz;
  v_city_text text;
  v_destination_text text;
  v_old_driver_id uuid;
  v_new_driver_id uuid;
BEGIN
  v_trip_id := NEW.trip_id;
  v_new_driver_id := NEW.driver_user_id;
  v_old_driver_id := OLD.driver_user_id;

  -- Se o motorista mudou e não é nulo agora
  IF (v_new_driver_id IS NOT NULL AND (v_old_driver_id IS NULL OR v_old_driver_id <> v_new_driver_id)) THEN
    SELECT departure_at, city_text, destination_text 
    INTO v_departure_at, v_city_text, v_destination_text
    FROM public.trip_requests 
    WHERE id = v_trip_id;

    INSERT INTO public.notifications (
      user_id,
      trip_id,
      type,
      title,
      body,
      link
    ) VALUES (
      v_new_driver_id,
      v_trip_id,
      'DRIVER_ASSIGNED',
      'Você foi definido como motorista',
      'Viagem para ' || COALESCE(v_city_text, 'destino') || ' em ' || to_char(v_departure_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      '/agenda-publica'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DROP TRIGGER IF EXISTS on_stop_driver_change ON public.trip_stops;
CREATE TRIGGER on_stop_driver_change
  AFTER UPDATE OF driver_user_id ON public.trip_stops
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_stop_driver_notification();
