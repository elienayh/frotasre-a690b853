
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE public.app_role AS ENUM ('admin','servidor');
CREATE TYPE public.vehicle_status AS ENUM ('DISPONIVEL','RESERVADO','EM_VIAGEM','EM_MANUTENCAO','INDISPONIVEL');
CREATE TYPE public.trip_status AS ENUM ('PENDENTE','CORRECAO','APROVADA','PROGRAMADA','EM_ANDAMENTO','CONCLUIDA','REJEITADA','CANCELADA');
CREATE TYPE public.block_type AS ENUM ('MANUTENCAO','INDISPONIVEL');
CREATE TYPE public.ride_status AS ENUM ('PENDENTE','APROVADA','REJEITADA');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  registration TEXT,
  sector TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ user_roles ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

CREATE POLICY "perfil proprio visivel" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "atualiza proprio perfil" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "cria proprio perfil" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "ve proprios papeis" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- signup trigger: profile + role (first user becomes admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, registration, sector, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NEW.raw_user_meta_data->>'registration',
    NEW.raw_user_meta_data->>'sector',
    NEW.raw_user_meta_data->>'phone'
  );
  SELECT count(*) INTO v_count FROM public.user_roles WHERE role = 'admin';
  IF v_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'servidor')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ vehicles ============
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT NOT NULL UNIQUE,
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  year INT,
  vehicle_type TEXT,
  fuel TEXT,
  capacity INT NOT NULL DEFAULT 5 CHECK (capacity > 0),
  asset_number TEXT,
  odometer INT NOT NULL DEFAULT 0,
  photo_url TEXT,
  notes TEXT,
  base_status public.vehicle_status NOT NULL DEFAULT 'DISPONIVEL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "veiculos visiveis" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia veiculos" ON public.vehicles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ drivers ============
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  license_number TEXT,
  license_category TEXT,
  phone TEXT,
  is_authorized BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "motoristas visiveis" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia motoristas" ON public.drivers FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ destinations ============
CREATE TABLE public.destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destinations TO authenticated;
GRANT ALL ON public.destinations TO service_role;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "destinos visiveis" ON public.destinations FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia destinos" ON public.destinations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ vehicle_blocks (manutencao / indisponibilidade) ============
CREATE TABLE public.vehicle_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  block_type public.block_type NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  period TSTZRANGE,
  workshop TEXT,
  city TEXT,
  reason TEXT,
  odometer_in INT,
  odometer_out INT,
  cost NUMERIC(12,2),
  service_done TEXT,
  notes TEXT,
  finished_at TIMESTAMPTZ,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_blocks_vehicle ON public.vehicle_blocks(vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_blocks TO authenticated;
GRANT ALL ON public.vehicle_blocks TO service_role;
ALTER TABLE public.vehicle_blocks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_blocks_updated BEFORE UPDATE ON public.vehicle_blocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "bloqueios visiveis" ON public.vehicle_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia bloqueios" ON public.vehicle_blocks FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.sync_block_period()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.period := tstzrange(NEW.starts_at, NEW.ends_at, '[)');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_block_period BEFORE INSERT OR UPDATE ON public.vehicle_blocks
  FOR EACH ROW EXECUTE FUNCTION public.sync_block_period();

-- ============ trip_requests ============
CREATE TABLE public.trip_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code SERIAL,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requester_name TEXT,
  destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,
  destination_text TEXT NOT NULL,
  purpose TEXT NOT NULL,
  passengers INT NOT NULL DEFAULT 1 CHECK (passengers > 0),
  occupants_names TEXT,
  suggested_driver TEXT,
  departure_at TIMESTAMPTZ NOT NULL,
  return_at TIMESTAMPTZ NOT NULL,
  status public.trip_status NOT NULL DEFAULT 'PENDENTE',
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE RESTRICT,
  admin_notes TEXT,
  rejection_reason TEXT,
  pw_number TEXT,
  pw_registered_at TIMESTAMPTZ,
  requester_notes TEXT,
  allows_rides BOOLEAN NOT NULL DEFAULT true,
  period TSTZRANGE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (return_at > departure_at)
);
CREATE INDEX idx_trips_vehicle ON public.trip_requests(vehicle_id);
CREATE INDEX idx_trips_requester ON public.trip_requests(requester_id);
CREATE INDEX idx_trips_status ON public.trip_requests(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_requests TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.trip_requests_code_seq TO authenticated;
GRANT ALL ON public.trip_requests TO service_role;
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trip_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_trip_period()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.period := tstzrange(NEW.departure_at, NEW.return_at, '[)');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_trip_period BEFORE INSERT OR UPDATE ON public.trip_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_trip_period();

-- nao permitir sobreposicao de veiculo/motorista em viagens ativas
ALTER TABLE public.trip_requests ADD CONSTRAINT trips_vehicle_no_overlap
  EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)
  WHERE (vehicle_id IS NOT NULL AND status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO'));
ALTER TABLE public.trip_requests ADD CONSTRAINT trips_driver_no_overlap
  EXCLUDE USING gist (driver_id WITH =, period WITH &&)
  WHERE (driver_id IS NOT NULL AND status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO'));

CREATE POLICY "viagens visiveis" ON public.trip_requests FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR public.is_admin()
    OR status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO','CONCLUIDA')
  );
CREATE POLICY "servidor cria solicitacao" ON public.trip_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'PENDENTE' AND vehicle_id IS NULL AND driver_id IS NULL);
CREATE POLICY "servidor edita pendente" ON public.trip_requests FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() AND status IN ('PENDENTE','CORRECAO'))
  WITH CHECK (requester_id = auth.uid() AND status IN ('PENDENTE','CORRECAO','CANCELADA'));
CREATE POLICY "admin gerencia viagens" ON public.trip_requests FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- validacao de alocacao (manutencao, capacidade, motorista autorizado)
CREATE OR REPLACE FUNCTION public.validate_trip_allocation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_cap INT; v_active BOOLEAN; v_auth BOOLEAN; v_block RECORD;
BEGIN
  IF NEW.vehicle_id IS NOT NULL AND NEW.status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO') THEN
    SELECT capacity, is_active INTO v_cap, v_active FROM public.vehicles WHERE id = NEW.vehicle_id;
    IF NOT v_active THEN
      RAISE EXCEPTION 'Veículo inativo não pode ser alocado.';
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
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_validate_trip BEFORE INSERT OR UPDATE ON public.trip_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_trip_allocation();

-- ============ ride_requests (caronas) ============
CREATE TABLE public.ride_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trip_requests(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seats INT NOT NULL DEFAULT 1 CHECK (seats > 0),
  reason TEXT,
  status public.ride_status NOT NULL DEFAULT 'PENDENTE',
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_requests TO authenticated;
GRANT ALL ON public.ride_requests TO service_role;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_rides_updated BEFORE UPDATE ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "caronas visiveis" ON public.ride_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.is_admin());
CREATE POLICY "servidor pede carona" ON public.ride_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'PENDENTE');
CREATE POLICY "servidor cancela carona" ON public.ride_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid() AND status = 'PENDENTE');
CREATE POLICY "admin gerencia caronas" ON public.ride_requests FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ notifications ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  trip_id UUID REFERENCES public.trip_requests(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "minhas notificacoes" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "marcar como lida" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin cria notificacao" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ============ trip_history ============
CREATE TABLE public.trip_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trip_requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.trip_history TO authenticated;
GRANT ALL ON public.trip_history TO service_role;
ALTER TABLE public.trip_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historico visivel" ON public.trip_history FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.trip_requests t WHERE t.id = trip_id AND t.requester_id = auth.uid()));
CREATE POLICY "registra historico" ON public.trip_history FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============ fuel_records ============
CREATE TABLE public.fuel_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  filled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  liters NUMERIC(10,2),
  unit_price NUMERIC(10,2),
  total_cost NUMERIC(12,2),
  odometer INT,
  station TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_records TO authenticated;
GRANT ALL ON public.fuel_records TO service_role;
ALTER TABLE public.fuel_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "abastecimentos visiveis" ON public.fuel_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia abastecimentos" ON public.fuel_records FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ funcao de disponibilidade ============
CREATE OR REPLACE FUNCTION public.fleet_availability(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ, p_passengers INT DEFAULT 0)
RETURNS TABLE (
  vehicle_id UUID, plate TEXT, manufacturer TEXT, model TEXT, capacity INT,
  photo_url TEXT, fuel TEXT, is_available BOOLEAN, reason TEXT, detail TEXT,
  conflict_start TIMESTAMPTZ, conflict_end TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
      SELECT * INTO b FROM public.vehicle_blocks
        WHERE vehicle_blocks.vehicle_id = r.id
          AND period && tstzrange(p_start, p_end, '[)')
        ORDER BY starts_at LIMIT 1;
      IF FOUND THEN
        is_available := false;
        reason := CASE WHEN b.block_type = 'MANUTENCAO' THEN 'EM_MANUTENCAO' ELSE 'INDISPONIVEL' END;
        detail := COALESCE(b.reason, b.workshop, 'Bloqueio administrativo');
        conflict_start := b.starts_at; conflict_end := b.ends_at;
      ELSE
        SELECT * INTO t FROM public.trip_requests
          WHERE trip_requests.vehicle_id = r.id
            AND status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO')
            AND period && tstzrange(p_start, p_end, '[)')
          ORDER BY departure_at LIMIT 1;
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
END; $$;
GRANT EXECUTE ON FUNCTION public.fleet_availability(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;

-- status atual calculado
CREATE OR REPLACE FUNCTION public.fleet_now()
RETURNS TABLE (
  vehicle_id UUID, plate TEXT, manufacturer TEXT, model TEXT, capacity INT, photo_url TEXT,
  status TEXT, detail TEXT, until_at TIMESTAMPTZ, next_trip_at TIMESTAMPTZ, next_trip_dest TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; b RECORD; t RECORD; n RECORD;
BEGIN
  FOR r IN SELECT * FROM public.vehicles ORDER BY plate LOOP
    vehicle_id := r.id; plate := r.plate; manufacturer := r.manufacturer; model := r.model;
    capacity := r.capacity; photo_url := r.photo_url;
    status := 'DISPONIVEL'; detail := NULL; until_at := NULL;
    next_trip_at := NULL; next_trip_dest := NULL;

    SELECT * INTO n FROM public.trip_requests
      WHERE trip_requests.vehicle_id = r.id AND status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO')
        AND return_at > now() ORDER BY departure_at LIMIT 1;
    IF FOUND THEN next_trip_at := n.departure_at; next_trip_dest := n.destination_text; END IF;

    IF NOT r.is_active THEN
      status := 'INDISPONIVEL'; detail := 'Veículo inativo';
    ELSE
      SELECT * INTO b FROM public.vehicle_blocks
        WHERE vehicle_blocks.vehicle_id = r.id AND period @> now() LIMIT 1;
      IF FOUND THEN
        status := CASE WHEN b.block_type = 'MANUTENCAO' THEN 'EM_MANUTENCAO' ELSE 'INDISPONIVEL' END;
        detail := COALESCE(b.reason, b.workshop); until_at := b.ends_at;
      ELSE
        SELECT * INTO t FROM public.trip_requests
          WHERE trip_requests.vehicle_id = r.id AND status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO')
            AND period @> now() LIMIT 1;
        IF FOUND THEN
          status := 'EM_VIAGEM'; detail := t.destination_text; until_at := t.return_at;
        ELSIF next_trip_at IS NOT NULL THEN
          status := 'RESERVADO'; detail := next_trip_dest; until_at := next_trip_at;
        END IF;
      END IF;
    END IF;
    RETURN NEXT;
  END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION public.fleet_now() TO authenticated;

-- ============ dados demonstrativos ============
INSERT INTO public.vehicles (plate, manufacturer, model, year, vehicle_type, fuel, capacity, asset_number, odometer, notes)
VALUES
 ('PUE8477','Fiat','Strada',2021,'Pick-up','Diesel',5,'PAT-1001',133065,'Veículo de uso geral'),
 ('OQM8523','Fiat','Palio',2016,'Hatch','Flex',5,'PAT-1002',201430,NULL),
 ('QXW3H27','Fiat','Cronos',2022,'Sedan','Flex',5,'PAT-1003',58210,NULL),
 ('QXW3F17','Chevrolet','S10',2020,'Pick-up','Diesel',5,'PAT-1004',97740,'Cabine dupla');

INSERT INTO public.drivers (full_name, license_number, license_category, phone, is_authorized)
VALUES ('Motorista 01','00000000001','D','(32) 90000-0001',true),
       ('Motorista 02','00000000002','D','(32) 90000-0002',true);

INSERT INTO public.destinations (name, city) VALUES
 ('SEE - Belo Horizonte','Belo Horizonte'),
 ('EE Interventor Júlio de Carvalho','Espera Feliz'),
 ('EE Maria Rosa de Freitas','Fervedouro'),
 ('EE Francisco Lentz','Caparaó');

INSERT INTO public.trip_requests (requester_name, destination_text, purpose, passengers, departure_at, return_at, status, vehicle_id, driver_id, admin_notes)
SELECT 'Servidor Demonstração A','SEE - Belo Horizonte','Reunião administrativa',3,
       (current_date + 7 + time '06:00') AT TIME ZONE 'America/Sao_Paulo',
       (current_date + 7 + time '20:00') AT TIME ZONE 'America/Sao_Paulo',
       'PROGRAMADA', v.id, d.id, 'Viagem de demonstração'
FROM public.vehicles v, public.drivers d
WHERE v.plate = 'QXW3H27' AND d.full_name = 'Motorista 01';

INSERT INTO public.trip_requests (requester_name, destination_text, purpose, passengers, departure_at, return_at, status, vehicle_id, driver_id)
SELECT 'Servidor Demonstração B','EE Interventor Júlio de Carvalho','Visita técnica',4,
       (current_date + 3 + time '07:00') AT TIME ZONE 'America/Sao_Paulo',
       (current_date + 3 + time '17:00') AT TIME ZONE 'America/Sao_Paulo',
       'APROVADA', v.id, d.id
FROM public.vehicles v, public.drivers d
WHERE v.plate = 'PUE8477' AND d.full_name = 'Motorista 02';

INSERT INTO public.trip_requests (requester_name, destination_text, purpose, passengers, departure_at, return_at, status, suggested_driver)
VALUES ('Servidor Demonstração C','EE Maria Rosa de Freitas','Entrega de documentos',2,
       (current_date + 5 + time '08:00') AT TIME ZONE 'America/Sao_Paulo',
       (current_date + 5 + time '14:00') AT TIME ZONE 'America/Sao_Paulo',
       'PENDENTE','Motorista 01');

INSERT INTO public.vehicle_blocks (vehicle_id, block_type, starts_at, ends_at, workshop, city, reason)
SELECT v.id,'MANUTENCAO',
       (current_date + 1 + time '08:00') AT TIME ZONE 'America/Sao_Paulo',
       (current_date + 9 + time '18:00') AT TIME ZONE 'America/Sao_Paulo',
       'Oficina Central','Manhuaçu','Revisão periódica'
FROM public.vehicles v WHERE v.plate = 'QXW3F17';
