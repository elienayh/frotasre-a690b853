-- Adicionar colunas de controle de manutenção na tabela de veículos
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS last_oil_change_km INTEGER,
ADD COLUMN IF NOT EXISTS next_oil_change_km INTEGER,
ADD COLUMN IF NOT EXISTS oil_change_date DATE,
ADD COLUMN IF NOT EXISTS oil_change_notes TEXT,
ADD COLUMN IF NOT EXISTS last_tire_change_km INTEGER,
ADD COLUMN IF NOT EXISTS next_tire_change_km INTEGER,
ADD COLUMN IF NOT EXISTS tire_change_date DATE,
ADD COLUMN IF NOT EXISTS tire_change_notes TEXT,
ADD COLUMN IF NOT EXISTS last_alignment_km INTEGER,
ADD COLUMN IF NOT EXISTS next_alignment_km INTEGER,
ADD COLUMN IF NOT EXISTS alignment_date DATE,
ADD COLUMN IF NOT EXISTS alignment_notes TEXT,
ADD COLUMN IF NOT EXISTS last_balancing_km INTEGER,
ADD COLUMN IF NOT EXISTS next_balancing_km INTEGER,
ADD COLUMN IF NOT EXISTS balancing_date DATE,
ADD COLUMN IF NOT EXISTS balancing_notes TEXT;

-- Criar tabela de histórico de hodômetro se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'odometer_history') THEN
        CREATE TABLE public.odometer_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
            recorded_at TIMESTAMPTZ DEFAULT now(),
            old_value INTEGER,
            new_value INTEGER NOT NULL,
            recorded_by UUID REFERENCES auth.users(id),
            source TEXT
        );

        GRANT SELECT, INSERT ON public.odometer_history TO authenticated;
        GRANT ALL ON public.odometer_history TO service_role;
        ALTER TABLE public.odometer_history ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Qualquer autenticado pode ver histórico de odômetro"
        ON public.odometer_history FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Qualquer autenticado pode registrar odômetro"
        ON public.odometer_history FOR INSERT
        TO authenticated
        WITH CHECK (true);
    END IF;
END $$;
