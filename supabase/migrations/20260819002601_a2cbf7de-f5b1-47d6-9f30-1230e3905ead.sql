-- Adicionar coluna 'reason' ao histórico de odômetro se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'odometer_history' AND column_name = 'reason') THEN
        ALTER TABLE public.odometer_history ADD COLUMN reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'odometer_history' AND column_name = 'origin') THEN
        ALTER TABLE public.odometer_history RENAME COLUMN source TO origin;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Função unificada para atualizar odômetro com registro de histórico
CREATE OR REPLACE FUNCTION public.update_vehicle_odometer(
    _vehicle_id UUID,
    _new_value INTEGER,
    _recorded_by UUID,
    _origin TEXT,
    _trip_id UUID DEFAULT NULL,
    _reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _old_value INTEGER;
BEGIN
    -- Pegar valor atual
    SELECT odometer INTO _old_value FROM public.vehicles WHERE id = _vehicle_id;
    
    -- Validação básica de segurança (evitar KM menor que atual, exceto para admins)
    -- Se new_value for menor que old_value, permite apenas se houver uma role de admin
    IF _new_value < _old_value AND NOT (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _recorded_by AND role IN ('admin'))
    ) THEN
        RAISE EXCEPTION 'A nova quilometragem (%) não pode ser inferior à atual (%). Apenas administradores podem realizar correções para valores menores.', _new_value, _old_value;
    END IF;

    -- Atualizar veículo
    UPDATE public.vehicles 
    SET odometer = _new_value,
        updated_at = now()
    WHERE id = _vehicle_id;

    -- Inserir no histórico
    INSERT INTO public.odometer_history (
        vehicle_id, 
        old_value, 
        new_value, 
        recorded_by, 
        origin, 
        trip_id, 
        reason
    ) VALUES (
        _vehicle_id, 
        _old_value, 
        _new_value, 
        _recorded_by, 
        _origin, 
        _trip_id, 
        _reason
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_vehicle_odometer(UUID, INTEGER, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT ALL ON public.odometer_history TO authenticated;
