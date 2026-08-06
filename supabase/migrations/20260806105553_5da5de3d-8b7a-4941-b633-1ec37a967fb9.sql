CREATE OR REPLACE FUNCTION public.fleet_now()
 RETURNS TABLE(vehicle_id uuid, plate text, manufacturer text, model text, capacity integer, photo_url text, status text, detail text, until_at timestamp with time zone, next_trip_at timestamp with time zone, next_trip_dest text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; b RECORD; t RECORD; n RECORD;
BEGIN
  FOR r IN SELECT * FROM public.vehicles ORDER BY plate LOOP
    vehicle_id := r.id; plate := r.plate; manufacturer := r.manufacturer; model := r.model;
    capacity := r.capacity; photo_url := r.photo_url;
    status := 'DISPONIVEL'; detail := NULL; until_at := NULL;
    next_trip_at := NULL; next_trip_dest := NULL;

    SELECT tr.* INTO n FROM public.trip_requests tr
      WHERE tr.vehicle_id = r.id AND tr.status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO')
        AND tr.return_at > now() ORDER BY tr.departure_at LIMIT 1;
    IF FOUND THEN next_trip_at := n.departure_at; next_trip_dest := n.destination_text; END IF;

    IF NOT r.is_active THEN
      status := 'INDISPONIVEL'; detail := 'Veículo inativo';
    ELSE
      SELECT vb.* INTO b FROM public.vehicle_blocks vb
        WHERE vb.vehicle_id = r.id AND vb.period @> now() LIMIT 1;
      IF FOUND THEN
        status := CASE WHEN b.block_type = 'MANUTENCAO' THEN 'EM_MANUTENCAO' ELSE 'INDISPONIVEL' END;
        detail := COALESCE(b.reason, b.workshop); until_at := b.ends_at;
      ELSE
        SELECT tr.* INTO t FROM public.trip_requests tr
          WHERE tr.vehicle_id = r.id AND tr.status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO')
            AND tr.period @> now() LIMIT 1;
        IF FOUND THEN
          status := 'EM_VIAGEM'; detail := t.destination_text; until_at := t.return_at;
        ELSIF next_trip_at IS NOT NULL THEN
          status := 'RESERVADO'; detail := next_trip_dest; until_at := next_trip_at;
        END IF;
      END IF;
    END IF;
    RETURN NEXT;
  END LOOP;
END; $function$;

CREATE OR REPLACE FUNCTION public.fleet_availability(p_start timestamp with time zone, p_end timestamp with time zone, p_passengers integer DEFAULT 0)
 RETURNS TABLE(vehicle_id uuid, plate text, manufacturer text, model text, capacity integer, photo_url text, fuel text, is_available boolean, reason text, detail text, conflict_start timestamp with time zone, conflict_end timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; b RECORD; t RECORD;
BEGIN
  FOR r IN SELECT * FROM public.vehicles ORDER BY plate LOOP
    vehicle_id := r.id; plate := r.plate; manufacturer := r.manufacturer; model := r.model;
    capacity := r.capacity; photo_url := r.photo_url; fuel := r.fuel;
    is_available := true; reason := 'DISPONIVEL'; detail := NULL;
    conflict_start := NULL; conflict_end := NULL;

    IF NOT r.is_active THEN
      is_available := false; reason := 'INATIVO'; detail := 'Veículo inativo';
    ELSE
      SELECT vb.* INTO b FROM public.vehicle_blocks vb
        WHERE vb.vehicle_id = r.id
          AND vb.period && tstzrange(p_start, p_end, '[)')
        ORDER BY vb.starts_at LIMIT 1;
      IF FOUND THEN
        is_available := false;
        reason := CASE WHEN b.block_type = 'MANUTENCAO' THEN 'EM_MANUTENCAO' ELSE 'INDISPONIVEL' END;
        detail := COALESCE(b.reason, b.workshop, 'Bloqueio administrativo');
        conflict_start := b.starts_at; conflict_end := b.ends_at;
      ELSE
        SELECT tr.* INTO t FROM public.trip_requests tr
          WHERE tr.vehicle_id = r.id
            AND tr.status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO')
            AND tr.period && tstzrange(p_start, p_end, '[)')
          ORDER BY tr.departure_at LIMIT 1;
        IF FOUND THEN
          is_available := false; reason := 'OCUPADO';
          detail := t.destination_text;
          conflict_start := t.departure_at; conflict_end := t.return_at;
        ELSIF p_passengers > 0 AND r.capacity < p_passengers THEN
          is_available := false; reason := 'CAPACIDADE';
          detail := 'Capacidade insuficiente — necessários ' || p_passengers || ' lugares.';
        END IF;
      END IF;
    END IF;
    RETURN NEXT;
  END LOOP;
END; $function$;