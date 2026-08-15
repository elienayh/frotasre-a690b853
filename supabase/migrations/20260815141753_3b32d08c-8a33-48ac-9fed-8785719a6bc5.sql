-- 1. Credenciamento para dirigir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_driver_certified boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET is_driver_certified = true WHERE is_sre_driver = true AND is_driver_certified = false;

CREATE OR REPLACE FUNCTION public.is_sre_driver(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_active AND is_sre_driver)
$$;

CREATE OR REPLACE FUNCTION public.can_certify_drivers(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'super_admin')
      OR public.is_sre_driver(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.set_driver_certified(_user_id uuid, _value boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old boolean;
BEGIN
  IF NOT public.can_certify_drivers(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o credenciamento.';
  END IF;
  SELECT is_driver_certified INTO _old FROM public.profiles WHERE id = _user_id;
  IF _old IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado.'; END IF;
  IF _old IS DISTINCT FROM _value THEN
    UPDATE public.profiles SET is_driver_certified = _value, updated_at = now() WHERE id = _user_id;
    INSERT INTO public.permission_history (actor_id, target_user_id, action, field_changed, old_value, new_value)
    VALUES (auth.uid(), _user_id, CASE WHEN _value THEN 'CREDENCIAMENTO_CONCEDIDO' ELSE 'CREDENCIAMENTO_REMOVIDO' END,
            'is_driver_certified', _old::text, _value::text);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_driver_certified(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_driver_certified(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_certify_drivers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sre_driver(uuid) TO authenticated;

-- 2. Motorista por destino
ALTER TABLE public.trip_stops ADD COLUMN IF NOT EXISTS driver_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Ocupantes da viagem
CREATE TABLE IF NOT EXISTS public.trip_occupants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_external boolean NOT NULL DEFAULT false,
  external_name text,
  external_document text,
  external_phone text,
  notes text,
  status text NOT NULL DEFAULT 'CONFIRMADO' CHECK (status IN ('CONFIRMADO','RECUSADO','REMOVIDO')),
  declined_at timestamptz,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_occupants_identity CHECK (
    (is_external = false AND user_id IS NOT NULL)
    OR (is_external = true AND external_name IS NOT NULL AND user_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS trip_occupants_unique_user ON public.trip_occupants (trip_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS trip_occupants_trip_idx ON public.trip_occupants (trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_occupants TO authenticated;
GRANT ALL ON public.trip_occupants TO service_role;
ALTER TABLE public.trip_occupants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_occupants(_trip_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'super_admin')
      OR public.is_sre_driver(_user_id)
      OR EXISTS (SELECT 1 FROM public.trip_requests t WHERE t.id = _trip_id AND t.requester_id = _user_id)
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_occupants(uuid, uuid) TO authenticated;

CREATE POLICY "Ocupantes visíveis para usuários autenticados"
  ON public.trip_occupants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores adicionam ocupantes"
  ON public.trip_occupants FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_occupants(trip_id, auth.uid()));
CREATE POLICY "Gestores e o próprio ocupante atualizam"
  ON public.trip_occupants FOR UPDATE TO authenticated
  USING (public.can_manage_occupants(trip_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.can_manage_occupants(trip_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Gestores removem ocupantes"
  ON public.trip_occupants FOR DELETE TO authenticated
  USING (public.can_manage_occupants(trip_id, auth.uid()));

CREATE TRIGGER trg_trip_occupants_updated_at
  BEFORE UPDATE ON public.trip_occupants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Notificações e histórico de ocupantes
CREATE OR REPLACE FUNCTION public.notify_occupant_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t RECORD;
  occ_name text;
BEGIN
  SELECT tr.id, tr.code, tr.destination_text, tr.departure_at, tr.requester_id
    INTO t FROM public.trip_requests tr WHERE tr.id = COALESCE(NEW.trip_id, OLD.trip_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL THEN
      PERFORM public.push_notification(NEW.user_id, 'OCUPANTE_INCLUIDO', 'Você foi incluído em uma viagem.',
        'Viagem #' || t.code || ' · ' || t.destination_text, t.id, 'trip', t.id, '/viagens?trip=' || t.id);
    END IF;
    INSERT INTO public.trip_history (trip_id, actor_id, action, details)
    VALUES (t.id, auth.uid(), 'OCUPANTE_INCLUIDO',
      COALESCE(NEW.external_name, (SELECT full_name FROM public.profiles WHERE id = NEW.user_id)));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.user_id IS NOT NULL THEN
      PERFORM public.push_notification(OLD.user_id, 'OCUPANTE_REMOVIDO', 'Você foi removido de uma viagem.',
        'Viagem #' || t.code || ' · ' || t.destination_text, t.id, 'trip', t.id, '/viagens?trip=' || t.id);
    END IF;
    INSERT INTO public.trip_history (trip_id, actor_id, action, details)
    VALUES (t.id, auth.uid(), 'OCUPANTE_REMOVIDO',
      COALESCE(OLD.external_name, (SELECT full_name FROM public.profiles WHERE id = OLD.user_id)));
    RETURN OLD;
  END IF;

  IF NEW.status = 'RECUSADO' AND OLD.status <> 'RECUSADO' THEN
    occ_name := COALESCE(NEW.external_name, (SELECT full_name FROM public.profiles WHERE id = NEW.user_id), 'Um ocupante');
    IF t.requester_id IS NOT NULL THEN
      PERFORM public.push_notification(t.requester_id, 'OCUPANTE_RECUSOU', 'Alteração nos ocupantes',
        occ_name || ' informou que não participará da viagem para ' || t.destination_text || '.',
        t.id, 'trip', t.id, '/viagens?trip=' || t.id);
    END IF;
    INSERT INTO public.trip_history (trip_id, actor_id, action, details)
    VALUES (t.id, auth.uid(), 'OCUPANTE_RECUSOU', occ_name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_occupant_change
  AFTER INSERT OR UPDATE OR DELETE ON public.trip_occupants
  FOR EACH ROW EXECUTE FUNCTION public.notify_occupant_change();