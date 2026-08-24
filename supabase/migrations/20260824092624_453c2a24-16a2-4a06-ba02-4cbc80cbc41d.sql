-- 1) Tabela de auditoria permanente de exclusões
CREATE TABLE public.deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text,
  snapshot jsonb,
  action text NOT NULL DEFAULT 'EXCLUSAO',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.deletion_audit TO authenticated;
GRANT ALL ON public.deletion_audit TO service_role;

ALTER TABLE public.deletion_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin le auditoria de exclusao"
  ON public.deletion_audit FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_deletion_audit_actor ON public.deletion_audit(actor_id, created_at DESC);
CREATE INDEX idx_deletion_audit_entity ON public.deletion_audit(entity_type, entity_id);

-- 2) Função genérica de auditoria de exclusão (SECURITY DEFINER: grava mesmo sem GRANT de INSERT)
CREATE OR REPLACE FUNCTION public.audit_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb := to_jsonb(OLD);
  v_summary text;
BEGIN
  v_summary := COALESCE(
    NULLIF(concat_ws(' · ',
      NULLIF(v_row->>'code', ''),
      NULLIF(v_row->>'full_name', ''),
      NULLIF(v_row->>'destination_text', ''),
      NULLIF(v_row->>'plate', ''),
      NULLIF(v_row->>'description', ''),
      NULLIF(v_row->>'external_name', ''),
      NULLIF(v_row->>'reason', ''),
      NULLIF(v_row->>'schedule_date', ''),
      NULLIF(v_row->>'place_text', '')
    ), ''),
    TG_TABLE_NAME || ' ' || COALESCE(v_row->>'id', '')
  );

  INSERT INTO public.deletion_audit (actor_id, entity_type, entity_id, summary, snapshot, action)
  VALUES (auth.uid(), TG_TABLE_NAME, (v_row->>'id')::uuid, v_summary, v_row, 'EXCLUSAO');

  RETURN OLD;
END;
$$;

-- 3) Triggers de auditoria nas tabelas históricas
CREATE TRIGGER trg_audit_del_trip_requests BEFORE DELETE ON public.trip_requests FOR EACH ROW EXECUTE FUNCTION public.audit_deletion();
CREATE TRIGGER trg_audit_del_trip_stops BEFORE DELETE ON public.trip_stops FOR EACH ROW EXECUTE FUNCTION public.audit_deletion();
CREATE TRIGGER trg_audit_del_trip_occupants BEFORE DELETE ON public.trip_occupants FOR EACH ROW EXECUTE FUNCTION public.audit_deletion();
CREATE TRIGGER trg_audit_del_ride_requests BEFORE DELETE ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.audit_deletion();
CREATE TRIGGER trg_audit_del_daily_schedules BEFORE DELETE ON public.daily_schedules FOR EACH ROW EXECUTE FUNCTION public.audit_deletion();
CREATE TRIGGER trg_audit_del_schedule_assignments BEFORE DELETE ON public.schedule_assignments FOR EACH ROW EXECUTE FUNCTION public.audit_deletion();
CREATE TRIGGER trg_audit_del_schedule_incidents BEFORE DELETE ON public.schedule_incidents FOR EACH ROW EXECUTE FUNCTION public.audit_deletion();
CREATE TRIGGER trg_audit_del_fuel_records BEFORE DELETE ON public.fuel_records FOR EACH ROW EXECUTE FUNCTION public.audit_deletion();
CREATE TRIGGER trg_audit_del_vehicle_blocks BEFORE DELETE ON public.vehicle_blocks FOR EACH ROW EXECUTE FUNCTION public.audit_deletion();

-- 4) Exclusão restrita ao super admin: substitui policies ALL por SELECT/INSERT/UPDATE + DELETE restrito

-- trip_requests
DROP POLICY "admin gerencia viagens" ON public.trip_requests;
CREATE POLICY "admin le viagens" ON public.trip_requests FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin cria viagens" ON public.trip_requests FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin edita viagens" ON public.trip_requests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "super admin exclui viagens" ON public.trip_requests FOR DELETE TO authenticated USING (public.is_super_admin());

-- trip_stops
DROP POLICY "paradas gerenciadas com a viagem" ON public.trip_stops;
CREATE POLICY "paradas visiveis com a viagem" ON public.trip_stops FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.trip_requests t WHERE t.id = trip_stops.trip_id AND (t.requester_id = auth.uid() OR public.is_coordinator_of(auth.uid(), public.profile_sector(t.requester_id)))));
CREATE POLICY "paradas criadas com a viagem" ON public.trip_stops FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.trip_requests t WHERE t.id = trip_stops.trip_id AND (t.requester_id = auth.uid() OR public.is_coordinator_of(auth.uid(), public.profile_sector(t.requester_id)))));
CREATE POLICY "paradas editadas com a viagem" ON public.trip_stops FOR UPDATE TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.trip_requests t WHERE t.id = trip_stops.trip_id AND (t.requester_id = auth.uid() OR public.is_coordinator_of(auth.uid(), public.profile_sector(t.requester_id)))))
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.trip_requests t WHERE t.id = trip_stops.trip_id AND (t.requester_id = auth.uid() OR public.is_coordinator_of(auth.uid(), public.profile_sector(t.requester_id)))));
CREATE POLICY "super admin exclui paradas" ON public.trip_stops FOR DELETE TO authenticated USING (public.is_super_admin());

-- trip_occupants
DROP POLICY "Gestores removem ocupantes" ON public.trip_occupants;
CREATE POLICY "super admin exclui ocupantes" ON public.trip_occupants FOR DELETE TO authenticated USING (public.is_super_admin());

-- ride_requests
DROP POLICY "admin gerencia caronas" ON public.ride_requests;
DROP POLICY "servidor cancela carona" ON public.ride_requests;
CREATE POLICY "admin le caronas" ON public.ride_requests FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin cria caronas" ON public.ride_requests FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin edita caronas" ON public.ride_requests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "super admin exclui caronas" ON public.ride_requests FOR DELETE TO authenticated USING (public.is_super_admin());

-- daily_schedules
DROP POLICY "admin gerencia escalas" ON public.daily_schedules;
CREATE POLICY "admin le escalas" ON public.daily_schedules FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin cria escalas" ON public.daily_schedules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin edita escalas" ON public.daily_schedules FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "super admin exclui escalas" ON public.daily_schedules FOR DELETE TO authenticated USING (public.is_super_admin());

-- schedule_assignments
DROP POLICY "admin gerencia atendimentos" ON public.schedule_assignments;
DROP POLICY "motorista gerencia atendimentos da sua escala" ON public.schedule_assignments;
CREATE POLICY "admin le atendimentos" ON public.schedule_assignments FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin cria atendimentos" ON public.schedule_assignments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin edita atendimentos" ON public.schedule_assignments FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "motorista le atendimentos da sua escala" ON public.schedule_assignments FOR SELECT TO authenticated
  USING (public.is_sre_driver(auth.uid()) AND public.is_schedule_driver(schedule_id, auth.uid()));
CREATE POLICY "motorista cria atendimentos da sua escala" ON public.schedule_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_sre_driver(auth.uid()) AND public.is_schedule_driver(schedule_id, auth.uid()));
CREATE POLICY "motorista edita atendimentos da sua escala" ON public.schedule_assignments FOR UPDATE TO authenticated
  USING (public.is_sre_driver(auth.uid()) AND public.is_schedule_driver(schedule_id, auth.uid()))
  WITH CHECK (public.is_sre_driver(auth.uid()) AND public.is_schedule_driver(schedule_id, auth.uid()));
CREATE POLICY "super admin exclui atendimentos" ON public.schedule_assignments FOR DELETE TO authenticated USING (public.is_super_admin());

-- schedule_incidents
DROP POLICY "admin gerencia ocorrencias" ON public.schedule_incidents;
CREATE POLICY "admin le ocorrencias" ON public.schedule_incidents FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin cria ocorrencias" ON public.schedule_incidents FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin edita ocorrencias" ON public.schedule_incidents FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "super admin exclui ocorrencias" ON public.schedule_incidents FOR DELETE TO authenticated USING (public.is_super_admin());

-- fuel_records
DROP POLICY "admin gerencia abastecimentos" ON public.fuel_records;
CREATE POLICY "admin le abastecimentos" ON public.fuel_records FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin cria abastecimentos" ON public.fuel_records FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin edita abastecimentos" ON public.fuel_records FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "super admin exclui abastecimentos" ON public.fuel_records FOR DELETE TO authenticated USING (public.is_super_admin());

-- vehicle_blocks
DROP POLICY "admin gerencia bloqueios" ON public.vehicle_blocks;
CREATE POLICY "admin le bloqueios" ON public.vehicle_blocks FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin cria bloqueios" ON public.vehicle_blocks FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin edita bloqueios" ON public.vehicle_blocks FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "super admin exclui bloqueios" ON public.vehicle_blocks FOR DELETE TO authenticated USING (public.is_super_admin());

-- 5) Evita bloqueio de exclusão da viagem pelo histórico de quilometragem (preserva o histórico)
ALTER TABLE public.odometer_history DROP CONSTRAINT odometer_history_trip_id_fkey;
ALTER TABLE public.odometer_history ADD CONSTRAINT odometer_history_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES public.trip_requests(id) ON DELETE SET NULL;