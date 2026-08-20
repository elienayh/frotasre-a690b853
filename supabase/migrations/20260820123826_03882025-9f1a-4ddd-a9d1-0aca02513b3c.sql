ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

-- Usuários existentes não são "novos" nem devem refazer o cadastro.
UPDATE public.profiles
   SET admin_reviewed_at = COALESCE(admin_reviewed_at, now()),
       profile_completed_at = COALESCE(profile_completed_at, now());

CREATE OR REPLACE FUNCTION public.mark_user_reviewed(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem confirmar a visualização de novos usuários.';
  END IF;

  UPDATE public.profiles
     SET admin_reviewed_at = now(),
         admin_reviewed_by = auth.uid()
   WHERE id = _user_id
     AND admin_reviewed_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_user_reviewed(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_user_reviewed(uuid) TO authenticated;

-- Impede que o próprio usuário altere campos administrativos do seu perfil.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.is_active := OLD.is_active;
  NEW.is_coordinator := OLD.is_coordinator;
  NEW.is_sre_driver := OLD.is_sre_driver;
  NEW.is_driver_certified := OLD.is_driver_certified;
  NEW.admin_reviewed_at := OLD.admin_reviewed_at;
  NEW.admin_reviewed_by := OLD.admin_reviewed_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_admin_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_admin_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();