-- ============================================================
-- 1. CIDADES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT ALL ON public.cities TO service_role;

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cidades visiveis" ON public.cities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia cidades" ON public.cities
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE UNIQUE INDEX IF NOT EXISTS cities_name_unique ON public.cities (lower(name));

CREATE TRIGGER trg_cities_updated BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.cities (name) VALUES
  ('Alto Caparaó'),
  ('Alvorada - Carangola'),
  ('Caiana'),
  ('Caparaó'),
  ('Carangola'),
  ('Divino'),
  ('Espera Feliz'),
  ('Faria Lemos'),
  ('Fervedouro'),
  ('Orizânia'),
  ('Pedra Dourada'),
  ('Tombos')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. LOCAIS DE DESTINO
-- ============================================================
ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS place_type text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER trg_destinations_updated BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- vincula destinos já existentes à cidade correspondente, quando houver
UPDATE public.destinations d
   SET city_id = c.id
  FROM public.cities c
 WHERE d.city_id IS NULL AND d.city IS NOT NULL AND lower(trim(d.city)) = lower(c.name);

CREATE UNIQUE INDEX IF NOT EXISTS destinations_city_name_unique
  ON public.destinations (city_id, lower(name)) WHERE city_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS destinations_city_id_idx ON public.destinations (city_id);

INSERT INTO public.destinations (name, city, city_id, place_type)
SELECT v.name, v.city, c.id, 'ESCOLA'
  FROM (VALUES
    ('EE Altivo Leopoldino de Souza','Espera Feliz'),
    ('EE Antônia Martins de Barros','Tombos'),
    ('EE Benedito Valadares','Carangola'),
    ('EE Bom Jesus do Madeira','Fervedouro'),
    ('EE Cel. Américo V. de Carvalho','Alto Caparaó'),
    ('EE Dos Dornelas','Orizânia'),
    ('EE Dr. Jonas de Faria Castro','Carangola'),
    ('EE Dr. Pedro Paulo Netto','Divino'),
    ('EE Emília Esteves Marques','Carangola'),
    ('EE Erênio de Souza Castro','Espera Feliz'),
    ('EE Fazenda Paraíso','Espera Feliz'),
    ('EE Ilka Campos Vargas','Tombos'),
    ('EE Interventor Júlio de Carvalho','Espera Feliz'),
    ('EE João Belo de Oliveira','Carangola'),
    ('EE Joaquim Bartholomeu Pedrosa','Fervedouro'),
    ('EE Maria da Conceição Gonçalves Carrara','Pedra Dourada'),
    ('EE Maria Rosa de Freitas','Fervedouro'),
    ('EE Marly de Castro Lima','Divino'),
    ('EE Melo Viana','Carangola'),
    ('EE Melo Viana','Divino'),
    ('EE Nascimento Leal','Alvorada - Carangola'),
    ('EE Pedro de Oliveira','Carangola'),
    ('EE Pedro Inácio Nogueira','Espera Feliz'),
    ('EE Prefeito Jayme Toledo','Caiana'),
    ('EE Professor Francisco Lentz','Caparaó'),
    ('EE São Mateus','Faria Lemos'),
    ('EE São Pedro do Glória','Fervedouro'),
    ('EE São Sebastião','Espera Feliz'),
    ('EE Vereador José de Souza Gomes','Divino'),
    ('EE Walton Batalha Lima','Carangola')
  ) AS v(name, city)
  JOIN public.cities c ON lower(c.name) = lower(v.city)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. MOTORISTAS DA SRE (perfis)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_sre_driver boolean NOT NULL DEFAULT false;

-- perfis ativos precisam ser visíveis para escolher o condutor
DROP POLICY IF EXISTS "perfil proprio visivel" ON public.profiles;
CREATE POLICY "perfil proprio visivel" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR public.is_coordinator_of(auth.uid(), sector)
    OR is_active
  );

-- ============================================================
-- 4. VEÍCULOS — placa única
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_plate_unique ON public.vehicles (upper(plate));

-- ============================================================
-- 5. CONDUTOR INDICADO / DEFINITIVO
-- ============================================================
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS requested_driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_driver_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_text text;

CREATE INDEX IF NOT EXISTS trip_requests_assigned_driver_idx
  ON public.trip_requests (assigned_driver_user_id);

DROP POLICY IF EXISTS "servidor cria solicitacao" ON public.trip_requests;
CREATE POLICY "servidor cria solicitacao" ON public.trip_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND public.is_active_user(auth.uid())
    AND status = 'PENDENTE'::trip_status
    AND vehicle_id IS NULL
    AND driver_id IS NULL
    AND assigned_driver_user_id IS NULL
  );

-- ============================================================
-- 6. PARADAS DA VIAGEM
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trip_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip_requests(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  city_text text,
  destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  place_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_stops TO authenticated;
GRANT ALL ON public.trip_stops TO service_role;

ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS trip_stops_trip_idx ON public.trip_stops (trip_id, position);

CREATE TRIGGER trg_trip_stops_updated BEFORE UPDATE ON public.trip_stops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "paradas visiveis" ON public.trip_stops
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trip_requests t WHERE t.id = trip_stops.trip_id));

CREATE POLICY "paradas gerenciadas com a viagem" ON public.trip_stops
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.trip_requests t
       WHERE t.id = trip_stops.trip_id
         AND (t.requester_id = auth.uid()
              OR public.is_coordinator_of(auth.uid(), public.profile_sector(t.requester_id)))
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.trip_requests t
       WHERE t.id = trip_stops.trip_id
         AND (t.requester_id = auth.uid()
              OR public.is_coordinator_of(auth.uid(), public.profile_sector(t.requester_id)))
    )
  );

-- ============================================================
-- 7. CONFLITO DE CONDUTOR
-- ============================================================
CREATE OR REPLACE FUNCTION public.driver_user_busy(
  _user_id uuid,
  _start timestamptz,
  _end timestamptz,
  _exclude_trip uuid DEFAULT NULL
) RETURNS TABLE(trip_id uuid, code integer, destination_text text, departure_at timestamptz, return_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT t.id, t.code, t.destination_text, t.departure_at, t.return_at
    FROM public.trip_requests t
   WHERE t.assigned_driver_user_id = _user_id
     AND t.status IN ('APROVADA','PROGRAMADA','EM_ANDAMENTO')
     AND (_exclude_trip IS NULL OR t.id <> _exclude_trip)
     AND tstzrange(t.departure_at, t.return_at, '[)') && tstzrange(_start, _end, '[)')
   ORDER BY t.departure_at
   LIMIT 5
$$;

CREATE OR REPLACE FUNCTION public.validate_trip_allocation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_cap INT; v_active BOOLEAN; v_auth BOOLEAN; v_block RECORD; v_conflict RECORD; v_name TEXT;
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