CREATE TABLE public.trip_occupant_destinations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occupant_id uuid NOT NULL REFERENCES public.trip_occupants(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES public.destinations(id) ON DELETE RESTRICT,
  trip_id uuid NOT NULL REFERENCES public.trip_requests(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (occupant_id, destination_id)
);

CREATE INDEX idx_tod_occupant ON public.trip_occupant_destinations(occupant_id);
CREATE INDEX idx_tod_trip ON public.trip_occupant_destinations(trip_id);
CREATE INDEX idx_tod_destination ON public.trip_occupant_destinations(destination_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_occupant_destinations TO authenticated;
GRANT ALL ON public.trip_occupant_destinations TO service_role;

ALTER TABLE public.trip_occupant_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Destinos por ocupante visíveis"
ON public.trip_occupant_destinations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores vinculam destinos de ocupantes"
ON public.trip_occupant_destinations FOR INSERT TO authenticated
WITH CHECK (public.can_manage_occupants(trip_id, auth.uid()));

CREATE POLICY "Gestores atualizam destinos de ocupantes"
ON public.trip_occupant_destinations FOR UPDATE TO authenticated
USING (public.can_manage_occupants(trip_id, auth.uid()))
WITH CHECK (public.can_manage_occupants(trip_id, auth.uid()));

CREATE POLICY "Gestores removem destinos de ocupantes"
ON public.trip_occupant_destinations FOR DELETE TO authenticated
USING (public.can_manage_occupants(trip_id, auth.uid()));

CREATE TRIGGER update_tod_updated_at
BEFORE UPDATE ON public.trip_occupant_destinations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permite criar automaticamente um local de destino ainda não cadastrado.
CREATE POLICY "Autenticados cadastram novos destinos"
ON public.destinations FOR INSERT TO authenticated
WITH CHECK (true);