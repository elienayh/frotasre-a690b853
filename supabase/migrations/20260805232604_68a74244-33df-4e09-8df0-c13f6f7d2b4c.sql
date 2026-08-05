ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_coordinator boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET sector = NULL
WHERE sector IS NOT NULL
  AND upper(btrim(sector)) NOT IN ('GABINETE','DAFI','DIRE','DIPE','NTE','INSPEÇÃO');

UPDATE public.profiles SET sector = upper(btrim(sector)) WHERE sector IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sector_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sector_check
  CHECK (sector IS NULL OR sector IN ('GABINETE','DAFI','DIRE','DIPE','NTE','INSPEÇÃO'));

CREATE OR REPLACE FUNCTION public.profile_sector(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sector FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_active FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.is_coordinator_of(_user_id uuid, _sector text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.is_coordinator
      AND p.is_active
      AND p.sector IS NOT NULL
      AND _sector IS NOT NULL
      AND p.sector = _sector
  )
$$;

DROP POLICY IF EXISTS "perfil proprio visivel" ON public.profiles;
CREATE POLICY "perfil proprio visivel" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR is_admin() OR public.is_coordinator_of(auth.uid(), sector));

DROP POLICY IF EXISTS "admin gerencia perfis" ON public.profiles;
CREATE POLICY "admin gerencia perfis" ON public.profiles
FOR UPDATE TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "servidor cria solicitacao" ON public.trip_requests;
CREATE POLICY "servidor cria solicitacao" ON public.trip_requests
FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND public.is_active_user(auth.uid())
  AND status = 'PENDENTE'::trip_status
  AND vehicle_id IS NULL
  AND driver_id IS NULL
);

DROP POLICY IF EXISTS "coordenador ve viagens do setor" ON public.trip_requests;
CREATE POLICY "coordenador ve viagens do setor" ON public.trip_requests
FOR SELECT TO authenticated
USING (public.is_coordinator_of(auth.uid(), public.profile_sector(requester_id)));

DROP POLICY IF EXISTS "coordenador edita viagens do setor" ON public.trip_requests;
CREATE POLICY "coordenador edita viagens do setor" ON public.trip_requests
FOR UPDATE TO authenticated
USING (
  public.is_coordinator_of(auth.uid(), public.profile_sector(requester_id))
  AND status = ANY (ARRAY['PENDENTE'::trip_status, 'CORRECAO'::trip_status])
)
WITH CHECK (
  public.is_coordinator_of(auth.uid(), public.profile_sector(requester_id))
  AND status = ANY (ARRAY['PENDENTE'::trip_status, 'CORRECAO'::trip_status, 'CANCELADA'::trip_status])
);