-- Garantir que a estrutura de ocupantes suporte a flag de motorista
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'trip_occupants' AND COLUMN_NAME = 'is_driver') THEN
    ALTER TABLE public.trip_occupants ADD COLUMN is_driver BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Trigger para sincronizar motoristas das paradas com a lista de ocupantes
CREATE OR REPLACE FUNCTION public.sync_trip_drivers_to_occupants()
RETURNS TRIGGER AS $$
DECLARE
  v_requester_id uuid;
BEGIN
  -- Remover registros de motoristas antigos para esta parada (se houver troca)
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND OLD.driver_user_id IS NOT NULL THEN
    -- Só removemos se o usuário não for motorista de OUTRA parada na mesma viagem
    IF NOT EXISTS (
      SELECT 1 FROM public.trip_stops 
      WHERE trip_id = OLD.trip_id 
        AND driver_user_id = OLD.driver_user_id 
        AND id <> OLD.id
    ) THEN
      DELETE FROM public.trip_occupants 
      WHERE trip_id = OLD.trip_id 
        AND user_id = OLD.driver_user_id 
        AND is_driver = TRUE;
    END IF;
  END IF;

  -- Adicionar novo motorista
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.driver_user_id IS NOT NULL THEN
    -- Pegar o solicitante para marcar quem "adicionou" (opcional)
    SELECT requester_id INTO v_requester_id FROM public.trip_requests WHERE id = NEW.trip_id;

    -- Inserir se não existir
    INSERT INTO public.trip_occupants (trip_id, user_id, is_driver, added_by, status)
    VALUES (NEW.trip_id, NEW.driver_user_id, TRUE, v_requester_id, 'CONFIRMADO')
    ON CONFLICT (trip_id, user_id) DO UPDATE SET is_driver = TRUE, status = 'CONFIRMADO';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- DROP TRIGGER IF EXISTS on_trip_stop_driver_sync ON public.trip_stops;
CREATE TRIGGER on_trip_stop_driver_sync
  AFTER INSERT OR UPDATE OF driver_user_id OR DELETE ON public.trip_stops
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_trip_drivers_to_occupants();
