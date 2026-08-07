
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS needs_sre_driver boolean NOT NULL DEFAULT false;

-- Backfill: viagens sem condutor indicado precisam de motorista da SRE
UPDATE public.trip_requests
   SET needs_sre_driver = true
 WHERE requested_driver_id IS NULL AND needs_sre_driver = false;

-- Situação atual da frota considerando status manual do veículo
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
    ELSIF r.base_status IN ('EM_MANUTENCAO','INDISPONIVEL') THEN
      status := r.base_status::text;
      detail := COALESCE(r.notes, 'Definido pelo DAFI');
      SELECT vb.* INTO b FROM public.vehicle_blocks vb
        WHERE vb.vehicle_id = r.id AND vb.is_open LIMIT 1;
      IF FOUND THEN
        detail := COALESCE(b.reason, b.workshop, detail);
        until_at := b.ends_at;
      END IF;
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

-- Disponibilidade por período considerando status manual
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
    ELSIF r.base_status IN ('EM_MANUTENCAO','INDISPONIVEL') THEN
      is_available := false; reason := r.base_status::text;
      detail := COALESCE(r.notes, 'Status definido pelo DAFI');
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

-- Bloqueia alocação de veículo marcado manualmente como indisponível/manutenção
CREATE OR REPLACE FUNCTION public.validate_trip_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_cap INT; v_active BOOLEAN; v_base TEXT; v_auth BOOLEAN; v_block RECORD; v_conflict RECORD; v_name TEXT;
BEGIN
  IF NEW.vehicle_id IS NOT NULL AND NEW.status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO') THEN
    SELECT capacity, is_active, base_status::text INTO v_cap, v_active, v_base
      FROM public.vehicles WHERE id = NEW.vehicle_id;
    IF NOT v_active THEN
      RAISE EXCEPTION 'Veículo inativo não pode ser alocado.';
    END IF;
    IF v_base = 'EM_MANUTENCAO' THEN
      RAISE EXCEPTION 'Veículo está em manutenção e não pode ser alocado.';
    END IF;
    IF v_base = 'INDISPONIVEL' THEN
      RAISE EXCEPTION 'Veículo está indisponível e não pode ser alocado.';
    END IF;
    IF v_cap < NEW.passengers THEN
      RAISE EXCEPTION 'Capacidade insuficiente — necessários % lugares.', NEW.passengers;
    END IF;
    SELECT * INTO v_block FROM public.vehicle_blocks
      WHERE vehicle_id = NEW.vehicle_id
        AND period && tstzrange(NEW.departure_at, NEW.return_at, '[)')
      LIMIT 1;
    IF FOUND THEN
      IF v_block.block_type = 'MANUTENCAO' THEN
        RAISE EXCEPTION 'Veículo em manutenção no período informado.';
      ELSE
        RAISE EXCEPTION 'Veículo indisponível administrativamente no período informado.';
      END IF;
    END IF;
  END IF;

  IF NEW.driver_id IS NOT NULL THEN
    SELECT is_authorized AND is_active INTO v_auth FROM public.drivers WHERE id = NEW.driver_id;
    IF NOT COALESCE(v_auth,false) THEN
      RAISE EXCEPTION 'Condutor não autorizado ou inativo.';
    END IF;
  END IF;

  IF NEW.assigned_driver_user_id IS NOT NULL
     AND NEW.status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO') THEN
    SELECT * INTO v_conflict FROM public.trip_requests t
      WHERE t.assigned_driver_user_id = NEW.assigned_driver_user_id
        AND t.id <> NEW.id
        AND t.status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO')
        AND tstzrange(t.departure_at, t.return_at, '[)')
            && tstzrange(NEW.departure_at, NEW.return_at, '[)')
      LIMIT 1;
    IF FOUND THEN
      SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.assigned_driver_user_id;
      RAISE EXCEPTION '% já está definido(a) como condutor(a) da viagem #% neste período.',
        COALESCE(v_name,'A pessoa selecionada'), v_conflict.code;
    END IF;
  END IF;

  RETURN NEW;
END; $function$;

-- Ao abrir/encerrar bloqueio de manutenção, refletir no status base do veículo
CREATE OR REPLACE FUNCTION public.sync_vehicle_base_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_open RECORD;
BEGIN
  v_id := COALESCE(NEW.vehicle_id, OLD.vehicle_id);
  SELECT * INTO v_open FROM public.vehicle_blocks
    WHERE vehicle_id = v_id AND is_open AND ends_at > now() LIMIT 1;
  IF FOUND THEN
    UPDATE public.vehicles
       SET base_status = CASE WHEN v_open.block_type = 'MANUTENCAO'
                              THEN 'EM_MANUTENCAO'::vehicle_status
                              ELSE 'INDISPONIVEL'::vehicle_status END
     WHERE id = v_id;
  ELSE
    UPDATE public.vehicles SET base_status = 'DISPONIVEL'::vehicle_status
     WHERE id = v_id AND base_status IN ('EM_MANUTENCAO','INDISPONIVEL');
  END IF;
  RETURN NULL;
END; $function$;

DROP TRIGGER IF EXISTS trg_sync_vehicle_base_status ON public.vehicle_blocks;
CREATE TRIGGER trg_sync_vehicle_base_status
AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_blocks
FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_base_status();
