-- 1. Notificações: tipo, entidade relacionada e link
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'GERAL',
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS link text;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Responsabilidade nas solicitações
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS organized_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS organized_at timestamptz;

-- 3. Helper de envio interno (sem checagem de permissão: uso apenas por triggers)
CREATE OR REPLACE FUNCTION public.push_notification(
  _user_id uuid, _type text, _title text, _body text,
  _trip_id uuid DEFAULT NULL, _entity_type text DEFAULT 'trip', _entity_id uuid DEFAULT NULL,
  _link text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, trip_id, entity_type, entity_id, link)
  VALUES (_user_id, _type, _title, _body, _trip_id, _entity_type, COALESCE(_entity_id, _trip_id), _link);
END $$;

CREATE OR REPLACE FUNCTION public.trip_label(_trip public.trip_requests)
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT to_char(_trip.departure_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
$$;

CREATE OR REPLACE FUNCTION public.vehicle_label(_vehicle_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT manufacturer || ' ' || model || ' — ' || plate FROM public.vehicles WHERE id = _vehicle_id), 'A definir')
$$;

CREATE OR REPLACE FUNCTION public.person_label(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT full_name FROM public.profiles WHERE id = _user_id), 'A definir')
$$;

-- 4. Carimbo de aprovação / recusa
CREATE OR REPLACE FUNCTION public.stamp_trip_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('APROVADA','PROGRAMADA') AND NEW.approved_at IS NULL THEN
      NEW.approved_by := auth.uid(); NEW.approved_at := now();
    END IF;
    IF NEW.status IN ('REJEITADA','CORRECAO') THEN
      NEW.rejected_by := auth.uid(); NEW.rejected_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_trip_decision ON public.trip_requests;
CREATE TRIGGER trg_stamp_trip_decision BEFORE UPDATE ON public.trip_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_trip_decision();

-- 5. Notificações da solicitação
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_link text; v_body text;
BEGIN
  v_link := '/admin/solicitacoes';
  v_body := COALESCE(public.person_label(NEW.requester_id), NEW.requester_name, 'Um servidor')
    || ' solicitou um veículo para ' || public.trip_label(NEW) || '.' || chr(10)
    || 'Destino: ' || NEW.destination_text || chr(10)
    || 'Horário previsto: ' || to_char(NEW.departure_at AT TIME ZONE 'America/Sao_Paulo','HH24:MI');
  FOR r IN
    SELECT DISTINCT p.id FROM public.profiles p
     WHERE p.is_active
       AND p.id <> COALESCE(NEW.requester_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND (p.is_sre_driver OR EXISTS (
             SELECT 1 FROM public.user_roles ur
              WHERE ur.user_id = p.id AND ur.role::text IN ('admin','super_admin')))
  LOOP
    PERFORM public.push_notification(r.id, 'NEW_TRIP_REQUEST', 'Nova solicitação de veículo', v_body, NEW.id, 'trip', NEW.id, v_link);
  END LOOP;

  INSERT INTO public.trip_history (trip_id, actor_id, action, details)
  VALUES (NEW.id, NEW.requester_id, 'CRIACAO', 'Solicitação criada.');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_trip_created ON public.trip_requests;
CREATE TRIGGER trg_notify_trip_created AFTER INSERT ON public.trip_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_trip_created();

CREATE OR REPLACE FUNCTION public.notify_trip_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_trip_link text; v_body text; v_actor uuid := auth.uid();
BEGIN
  v_trip_link := '/agenda-publica?trip=' || NEW.id::text;

  -- Status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'APROVADA' THEN
      PERFORM public.push_notification(NEW.requester_id, 'TRIP_APPROVED', 'Solicitação aprovada',
        'Sua solicitação de veículo para ' || public.trip_label(NEW) || ' foi aprovada.' || chr(10)
        || 'Destino: ' || NEW.destination_text || chr(10)
        || 'Veículo: ' || public.vehicle_label(NEW.vehicle_id) || chr(10)
        || 'Motorista: ' || public.person_label(NEW.assigned_driver_user_id),
        NEW.id, 'trip', NEW.id, v_trip_link);
      INSERT INTO public.trip_history (trip_id, actor_id, action, details)
      VALUES (NEW.id, v_actor, 'APROVACAO', 'Solicitação aprovada.');
    ELSIF NEW.status IN ('REJEITADA','CORRECAO') THEN
      PERFORM public.push_notification(NEW.requester_id, 'TRIP_REJECTED',
        CASE WHEN NEW.status = 'REJEITADA' THEN 'Solicitação não aprovada' ELSE 'Correção solicitada' END,
        'Sua solicitação de veículo para ' || public.trip_label(NEW) || ' precisa de atenção.' || chr(10)
        || 'Motivo: ' || COALESCE(NEW.rejection_reason, 'não informado'),
        NEW.id, 'trip', NEW.id, '/solicitacoes');
      INSERT INTO public.trip_history (trip_id, actor_id, action, details)
      VALUES (NEW.id, v_actor, NEW.status::text, COALESCE(NEW.rejection_reason,'—'));
    ELSIF NEW.status = 'CANCELADA' THEN
      PERFORM public.push_notification(NEW.requester_id, 'TRIP_CANCELLED', 'Viagem cancelada',
        'A viagem de ' || public.trip_label(NEW) || ' foi cancelada.', NEW.id, 'trip', NEW.id, '/solicitacoes');
      PERFORM public.push_notification(NEW.assigned_driver_user_id, 'TRIP_CANCELLED', 'Viagem cancelada',
        'A viagem #' || NEW.code || ' de ' || public.trip_label(NEW) || ' foi cancelada.', NEW.id, 'trip', NEW.id, v_trip_link);
      INSERT INTO public.trip_history (trip_id, actor_id, action, details)
      VALUES (NEW.id, v_actor, 'CANCELAMENTO', 'Viagem cancelada.');
    END IF;
  END IF;

  -- Motorista
  IF NEW.assigned_driver_user_id IS DISTINCT FROM OLD.assigned_driver_user_id THEN
    IF NEW.assigned_driver_user_id IS NOT NULL THEN
      PERFORM public.push_notification(NEW.assigned_driver_user_id, 'DRIVER_ASSIGNED', 'Viagem atribuída',
        'Você foi definido como motorista da viagem #' || NEW.code || '.' || chr(10)
        || 'Data: ' || public.trip_label(NEW) || chr(10)
        || 'Saída prevista: ' || to_char(NEW.departure_at AT TIME ZONE 'America/Sao_Paulo','HH24:MI') || chr(10)
        || 'Destino: ' || NEW.destination_text || chr(10)
        || 'Veículo: ' || public.vehicle_label(NEW.vehicle_id),
        NEW.id, 'trip', NEW.id, v_trip_link);
    END IF;
    IF OLD.assigned_driver_user_id IS NOT NULL THEN
      PERFORM public.push_notification(OLD.assigned_driver_user_id, 'TRIP_UPDATED', 'Viagem reatribuída',
        'Você não é mais o motorista da viagem #' || NEW.code || ' (' || public.trip_label(NEW) || ').',
        NEW.id, 'trip', NEW.id, v_trip_link);
      PERFORM public.push_notification(NEW.requester_id, 'TRIP_UPDATED', 'Motorista alterado',
        'O motorista da sua viagem de ' || public.trip_label(NEW) || ' foi alterado.' || chr(10)
        || 'Novo motorista: ' || public.person_label(NEW.assigned_driver_user_id),
        NEW.id, 'trip', NEW.id, v_trip_link);
    END IF;
    INSERT INTO public.trip_history (trip_id, actor_id, action, details)
    VALUES (NEW.id, v_actor, 'MOTORISTA', 'Motorista definido: ' || public.person_label(NEW.assigned_driver_user_id));
  END IF;

  -- Veículo
  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id AND NEW.vehicle_id IS NOT NULL THEN
    PERFORM public.push_notification(NEW.requester_id, 'VEHICLE_ASSIGNED', 'Veículo definido',
      'O veículo da sua viagem de ' || public.trip_label(NEW) || ' é ' || public.vehicle_label(NEW.vehicle_id) || '.',
      NEW.id, 'trip', NEW.id, v_trip_link);
    INSERT INTO public.trip_history (trip_id, actor_id, action, details)
    VALUES (NEW.id, v_actor, 'VEICULO', 'Veículo definido: ' || public.vehicle_label(NEW.vehicle_id));
  END IF;

  -- Horário / destino
  IF (NEW.departure_at IS DISTINCT FROM OLD.departure_at OR NEW.return_at IS DISTINCT FROM OLD.return_at
      OR NEW.destination_text IS DISTINCT FROM OLD.destination_text) THEN
    v_body := 'A programação da sua viagem de ' || public.trip_label(NEW) || ' foi alterada.' || chr(10)
      || 'Horário anterior: ' || to_char(OLD.departure_at AT TIME ZONE 'America/Sao_Paulo','HH24:MI') || chr(10)
      || 'Novo horário: ' || to_char(NEW.departure_at AT TIME ZONE 'America/Sao_Paulo','HH24:MI') || chr(10)
      || 'Destino: ' || NEW.destination_text;
    IF v_actor IS DISTINCT FROM NEW.requester_id THEN
      PERFORM public.push_notification(NEW.requester_id, 'TRIP_UPDATED', 'Viagem alterada', v_body, NEW.id, 'trip', NEW.id, v_trip_link);
    END IF;
    PERFORM public.push_notification(NEW.assigned_driver_user_id, 'TRIP_UPDATED', 'Viagem alterada',
      'A viagem #' || NEW.code || ' foi alterada. Novo horário: '
      || to_char(NEW.departure_at AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || '.',
      NEW.id, 'trip', NEW.id, v_trip_link);
    INSERT INTO public.trip_history (trip_id, actor_id, action, details)
    VALUES (NEW.id, v_actor, 'ALTERACAO', 'Programação alterada.');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_trip_changed ON public.trip_requests;
CREATE TRIGGER trg_notify_trip_changed AFTER UPDATE ON public.trip_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_trip_changed();

-- 6. Organização do dia
CREATE OR REPLACE FUNCTION public.notify_schedule_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_driver uuid; v_vehicle uuid; v_date date; v_actor uuid := auth.uid(); v_requester uuid;
BEGIN
  SELECT s.driver_user_id, s.vehicle_id, s.schedule_date INTO v_driver, v_vehicle, v_date
    FROM public.daily_schedules s WHERE s.id = NEW.schedule_id;

  IF NEW.trip_id IS NOT NULL THEN
    SELECT requester_id INTO v_requester FROM public.trip_requests WHERE id = NEW.trip_id;
    UPDATE public.trip_requests
       SET organized_by = COALESCE(v_actor, organized_by), organized_at = now()
     WHERE id = NEW.trip_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.push_notification(v_driver, 'SCHEDULE_CREATED', 'Viagem adicionada à sua programação',
      'Você foi incluído na programação do dia ' || to_char(v_date,'DD/MM/YYYY') || '.' || chr(10)
      || to_char(NEW.scheduled_departure AT TIME ZONE 'America/Sao_Paulo','HH24:MI') || '  '
      || NEW.origin_text || ' → ' || NEW.destination_text || chr(10)
      || 'Veículo: ' || public.vehicle_label(v_vehicle),
      NEW.trip_id, 'schedule', NEW.schedule_id, '/organizacao?date=' || to_char(v_date,'YYYY-MM-DD'));
    PERFORM public.push_notification(v_requester, 'SCHEDULE_CREATED', 'Sua viagem foi programada',
      'Sua viagem foi incluída na programação de ' || to_char(v_date,'DD/MM/YYYY') || ' às '
      || to_char(NEW.scheduled_departure AT TIME ZONE 'America/Sao_Paulo','HH24:MI') || '.'
      || chr(10) || 'Motorista: ' || public.person_label(v_driver),
      NEW.trip_id, 'trip', NEW.trip_id, '/solicitacoes');
  ELSIF (NEW.scheduled_departure IS DISTINCT FROM OLD.scheduled_departure
      OR NEW.order_index IS DISTINCT FROM OLD.order_index
      OR NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM public.push_notification(v_driver, 'SCHEDULE_UPDATED', 'Programação alterada',
      'Um atendimento da programação de ' || to_char(v_date,'DD/MM/YYYY') || ' foi alterado: '
      || to_char(NEW.scheduled_departure AT TIME ZONE 'America/Sao_Paulo','HH24:MI') || ' — ' || NEW.destination_text || '.',
      NEW.trip_id, 'schedule', NEW.schedule_id, '/organizacao?date=' || to_char(v_date,'YYYY-MM-DD'));
    IF NEW.scheduled_departure IS DISTINCT FROM OLD.scheduled_departure THEN
      PERFORM public.push_notification(v_requester, 'SCHEDULE_UPDATED', 'Horário da sua viagem alterado',
        'Horário anterior: ' || to_char(OLD.scheduled_departure AT TIME ZONE 'America/Sao_Paulo','HH24:MI') || chr(10)
        || 'Novo horário: ' || to_char(NEW.scheduled_departure AT TIME ZONE 'America/Sao_Paulo','HH24:MI'),
        NEW.trip_id, 'trip', NEW.trip_id, '/solicitacoes');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_schedule_assignment ON public.schedule_assignments;
CREATE TRIGGER trg_notify_schedule_assignment AFTER INSERT OR UPDATE ON public.schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_schedule_assignment();

-- 7. Caronas
CREATE OR REPLACE FUNCTION public.notify_ride_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_trip public.trip_requests;
BEGIN
  SELECT * INTO v_trip FROM public.trip_requests WHERE id = NEW.trip_id;
  IF TG_OP = 'INSERT' THEN
    FOR r IN SELECT p.id FROM public.profiles p
              WHERE p.is_active AND EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = p.id AND ur.role::text IN ('admin','super_admin'))
    LOOP
      PERFORM public.push_notification(r.id, 'RIDE_REQUESTED', 'Novo pedido de carona',
        public.person_label(NEW.requester_id) || ' pediu ' || NEW.seats || ' vaga(s) na viagem #'
        || v_trip.code || ' (' || public.trip_label(v_trip) || ').',
        NEW.trip_id, 'trip', NEW.trip_id, '/agenda-publica?trip=' || NEW.trip_id::text);
    END LOOP;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.push_notification(NEW.requester_id,
      CASE WHEN NEW.status::text = 'APROVADA' THEN 'RIDE_APPROVED' ELSE 'RIDE_REJECTED' END,
      CASE WHEN NEW.status::text = 'APROVADA' THEN 'Carona aprovada' ELSE 'Carona não aprovada' END,
      'Seu pedido de carona na viagem #' || v_trip.code || ' (' || public.trip_label(v_trip) || ') foi '
      || lower(NEW.status::text) || '.' || COALESCE(chr(10) || 'Observação: ' || NEW.decision_note, ''),
      NEW.trip_id, 'trip', NEW.trip_id, '/agenda-publica?trip=' || NEW.trip_id::text);
    PERFORM public.push_notification(v_trip.assigned_driver_user_id, 'TRIP_UPDATED', 'Lotação alterada',
      'A lotação da viagem #' || v_trip.code || ' foi atualizada por uma carona.',
      NEW.trip_id, 'trip', NEW.trip_id, '/agenda-publica?trip=' || NEW.trip_id::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_ride_request ON public.ride_requests;
CREATE TRIGGER trg_notify_ride_request AFTER INSERT OR UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_ride_request();
