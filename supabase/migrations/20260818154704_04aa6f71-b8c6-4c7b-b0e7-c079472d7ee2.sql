-- Adicionar novas colunas de manutenção na tabela vehicles
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS last_oil_filter_change_km INTEGER,
ADD COLUMN IF NOT EXISTS next_oil_filter_change_km INTEGER,
ADD COLUMN IF NOT EXISTS oil_filter_change_date DATE,
ADD COLUMN IF NOT EXISTS oil_filter_change_notes TEXT,
ADD COLUMN IF NOT EXISTS last_air_filter_change_km INTEGER,
ADD COLUMN IF NOT EXISTS next_air_filter_change_km INTEGER,
ADD COLUMN IF NOT EXISTS air_filter_change_date DATE,
ADD COLUMN IF NOT EXISTS air_filter_change_notes TEXT;

-- Garantir que maintenance_history tenha a estrutura correta para o novo fluxo
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_history' AND column_name = 'performed_date') THEN
        ALTER TABLE public.maintenance_history ADD COLUMN performed_date DATE DEFAULT now();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_history' AND column_name = 'recorded_by') THEN
        ALTER TABLE public.maintenance_history ADD COLUMN recorded_by UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- Comentários para documentação
COMMENT ON COLUMN public.vehicles.last_oil_filter_change_km IS 'KM da última troca do filtro de óleo';
COMMENT ON COLUMN public.vehicles.next_oil_filter_change_km IS 'KM da próxima troca do filtro de óleo';
COMMENT ON COLUMN public.vehicles.last_air_filter_change_km IS 'KM da última troca do filtro de ar';
COMMENT ON COLUMN public.vehicles.next_air_filter_change_km IS 'KM da próxima troca do filtro de ar';
