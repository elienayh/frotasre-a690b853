-- 1. SUPER ADMIN ---------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. AUDITORIA DE PERMISSOES ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.permission_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id),
  target_user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permission_history TO authenticated;
GRANT ALL ON public.permission_history TO service_role;
ALTER TABLE public.permission_history ENABLE ROW LEVEL SECURITY;

-- 3. DADOS DO MOTORISTA NO PERFIL ----------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS cnh_number text,
  ADD COLUMN IF NOT EXISTS cnh_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cnh_issued_at date,
  ADD COLUMN IF NOT EXISTS cnh_expires_at date,
  ADD COLUMN IF NOT EXISTS cnh_first_at date,
  ADD COLUMN IF NOT EXISTS cnh_notes text;

-- migra dados dos motoristas ja vinculados a usuarios (sem apagar nada)
UPDATE public.profiles p SET
  cpf = COALESCE(p.cpf, d.cpf),
  birth_date = COALESCE(p.birth_date, d.birth_date),
  mobile = COALESCE(p.mobile, d.mobile),
  address = COALESCE(p.address, d.address),
  address_number = COALESCE(p.address_number, d.address_number),
  complement = COALESCE(p.complement, d.complement),
  district = COALESCE(p.district, d.district),
  city = COALESCE(p.city, d.city),
  state = COALESCE(p.state, d.state),
  zip_code = COALESCE(p.zip_code, d.zip_code),
  cnh_number = COALESCE(p.cnh_number, d.license_number),
  cnh_categories = CASE WHEN cardinality(p.cnh_categories) = 0 THEN COALESCE(d.cnh_categories, '{}') ELSE p.cnh_categories END,
  cnh_issued_at = COALESCE(p.cnh_issued_at, d.cnh_issued_at),
  cnh_expires_at = COALESCE(p.cnh_expires_at, d.cnh_expires_at),
  cnh_first_at = COALESCE(p.cnh_first_at, d.cnh_first_at),
  cnh_notes = COALESCE(p.cnh_notes, d.cnh_notes),
  is_sre_driver = p.is_sre_driver OR (d.is_active AND d.is_authorized)
FROM public.drivers d
WHERE d.profile_id = p.id;

-- 4. REMOVE BLOQUEIOS POR PERIODO ORIGINAL --------------------------------
ALTER TABLE public.trip_requests DROP CONSTRAINT IF EXISTS trips_driver_no_overlap;
ALTER TABLE public.trip_requests DROP CONSTRAINT IF EXISTS trips_vehicle_no_overlap;

CREATE OR REPLACE FUNCTION public.validate_trip_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_cap INT; v_active BOOLEAN; v_base TEXT;
BEGIN
  -- Regras reais do veiculo permanecem; sobreposicao de periodo virou apenas alerta na interface.
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
  END IF;
  RETURN NEW;
END; $function$;

-- disponibilidade: sobreposicao vira aviso, nao indisponibilidade
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
      detail := COALESCE(r.notes, 'Status definido pela DAFI');
    ELSIF p_passengers > 0 AND r.capacity < p_passengers THEN
      is_available := false; reason := 'CAPACIDADE';
      detail := 'Capacidade insuficiente — necessários ' || p_passengers || ' lugares.';
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
          -- alerta operacional: o periodo solicitado nao reserva o veiculo
          is_available := true; reason := 'ALERTA';
          detail := 'Também previsto para ' || t.destination_text;
          conflict_start := t.departure_at; conflict_end := t.return_at;
        END IF;
      END IF;
    END IF;
    RETURN NEXT;
  END LOOP;
END; $function$;

-- 5. FUNCOES DE PAPEL -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role::text IN ('admin','super_admin')
  );
$$;

CREATE POLICY "auditoria visivel para admin" ON public.permission_history
  FOR SELECT TO authenticated USING (public.is_admin() OR target_user_id = auth.uid());

-- 6. GESTAO SEGURA DE PAPEIS ---------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_actor uuid := auth.uid(); v_super_count int; v_had boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão para alterar papéis administrativos.';
  END IF;
  IF _role::text NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'Papel inválido para esta operação.';
  END IF;

  -- somente super admin mexe em super admin
  IF (_role::text = 'super_admin' OR public.is_super_admin(_user_id)) AND NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas um Super Admin pode alterar privilégios de Super Admin.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) INTO v_had;

  IF _grant THEN
    IF v_had THEN RETURN; END IF;
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    IF NOT v_had THEN RETURN; END IF;
    IF _role::text = 'super_admin' THEN
      SELECT count(*) INTO v_super_count
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
       WHERE ur.role::text = 'super_admin' AND p.is_active;
      IF v_super_count <= 1 THEN
        RAISE EXCEPTION 'Não é possível remover o último Super Admin do sistema.';
      END IF;
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;

  INSERT INTO public.permission_history (actor_id, target_user_id, action, field_changed, old_value, new_value)
  VALUES (v_actor, _user_id,
          CASE WHEN _grant THEN 'ROLE_GRANT' ELSE 'ROLE_REVOKE' END,
          _role::text,
          CASE WHEN _grant THEN 'não' ELSE 'sim' END,
          CASE WHEN _grant THEN 'sim' ELSE 'não' END);
END $$;

GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, app_role, boolean) TO authenticated;

-- 7. PROTECAO DOS CAMPOS PRIVILEGIADOS DO PERFIL --------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.is_coordinator IS DISTINCT FROM OLD.is_coordinator
      OR NEW.is_sre_driver IS DISTINCT FROM OLD.is_sre_driver)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem alterar permissões de usuário.';
  END IF;

  IF NEW.is_coordinator IS DISTINCT FROM OLD.is_coordinator THEN
    INSERT INTO public.permission_history (actor_id, target_user_id, action, field_changed, old_value, new_value)
    VALUES (auth.uid(), NEW.id, 'PROFILE_FLAG', 'coordenador', OLD.is_coordinator::text, NEW.is_coordinator::text);
  END IF;
  IF NEW.is_sre_driver IS DISTINCT FROM OLD.is_sre_driver THEN
    INSERT INTO public.permission_history (actor_id, target_user_id, action, field_changed, old_value, new_value)
    VALUES (auth.uid(), NEW.id, 'PROFILE_FLAG', 'motorista_sre', OLD.is_sre_driver::text, NEW.is_sre_driver::text);
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    INSERT INTO public.permission_history (actor_id, target_user_id, action, field_changed, old_value, new_value)
    VALUES (auth.uid(), NEW.id, 'PROFILE_FLAG', 'login_ativo', OLD.is_active::text, NEW.is_active::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileges ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- 8. MOTORISTAS OFICIAIS = USUARIOS ---------------------------------------
CREATE OR REPLACE FUNCTION public.is_sre_driver(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_sre_driver AND is_active);
$$;
