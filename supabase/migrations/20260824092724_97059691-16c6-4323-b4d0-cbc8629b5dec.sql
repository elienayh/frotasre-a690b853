-- trip_stops: volta a permitir exclusão por quem gerencia a viagem (edição de trechos)
DROP POLICY IF EXISTS "super admin exclui paradas" ON public.trip_stops;
CREATE POLICY "paradas excluidas com a viagem" ON public.trip_stops FOR DELETE TO authenticated
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.trip_requests t
    WHERE t.id = trip_stops.trip_id
      AND (t.requester_id = auth.uid() OR public.is_coordinator_of(auth.uid(), public.profile_sector(t.requester_id)))
  ));

-- trip_occupants: volta a permitir remoção por quem gerencia os ocupantes da viagem
DROP POLICY IF EXISTS "super admin exclui ocupantes" ON public.trip_occupants;
CREATE POLICY "Gestores removem ocupantes" ON public.trip_occupants FOR DELETE TO authenticated
  USING (public.can_manage_occupants(trip_id, auth.uid()));

-- schedule_assignments: remoção de trecho da escala é operação normal de admin/motorista da escala
DROP POLICY IF EXISTS "super admin exclui atendimentos" ON public.schedule_assignments;
CREATE POLICY "gestores removem atendimentos" ON public.schedule_assignments FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_sre_driver(auth.uid()) AND public.is_schedule_driver(schedule_id, auth.uid())));