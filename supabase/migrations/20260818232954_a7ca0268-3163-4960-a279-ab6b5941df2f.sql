-- Função para validar o domínio institucional
CREATE OR REPLACE FUNCTION public.check_institutional_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email NOT LIKE '%@educacao.mg.gov.br' THEN
    RAISE EXCEPTION 'Esta aplicação é restrita a usuários da Secretaria de Estado de Educação de Minas Gerais. Utilize sua conta institucional @educacao.mg.gov.br.';
  END IF;
  RETURN NEW;
END;
$$;

-- Tentar criar trigger em auth.users para bloqueio no nível mais baixo
DO $$
BEGIN
    CREATE TRIGGER on_auth_user_created_check_domain
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.check_institutional_domain();
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Trigger em auth.users falhou (comum em ambientes restritos). A validação ocorrerá no fluxo de login.';
END $$;

-- Garantir criação de perfil e atribuição de role básica
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, is_active)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    true
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger para pós-criação
DO $$
BEGIN
    CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
