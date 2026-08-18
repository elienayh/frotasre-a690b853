-- Adicionar colunas necessárias para manutenção preventiva detalhada se não existirem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'manufacturer') THEN
        ALTER TABLE public.vehicles ADD COLUMN manufacturer TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'model') THEN
        ALTER TABLE public.vehicles ADD COLUMN model TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'next_oil_change_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN next_oil_change_km INTEGER;
        ALTER TABLE public.vehicles ADD COLUMN last_oil_change_km INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'next_tire_change_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN next_tire_change_km INTEGER;
        ALTER TABLE public.vehicles ADD COLUMN last_tire_change_km INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'next_alignment_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN next_alignment_km INTEGER;
        ALTER TABLE public.vehicles ADD COLUMN last_alignment_km INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'next_balancing_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN next_balancing_km INTEGER;
        ALTER TABLE public.vehicles ADD COLUMN last_balancing_km INTEGER;
    END IF;
END $$;

-- Tabela de histórico de quilometragem
CREATE TABLE IF NOT EXISTS public.odometer_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    old_value INTEGER,
    new_value INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    recorded_by UUID REFERENCES public.profiles(id),
    origin TEXT NOT NULL, -- 'trip_start', 'trip_end', 'manual', 'maintenance', 'fuel'
    trip_id UUID REFERENCES public.trip_requests(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.odometer_history TO authenticated;
GRANT ALL ON public.odometer_history TO service_role;
ALTER TABLE public.odometer_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can select odometer history" ON public.odometer_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert odometer history" ON public.odometer_history FOR INSERT TO authenticated WITH CHECK (true);

-- Tabela de histórico de manutenções detalhadas
CREATE TABLE IF NOT EXISTS public.maintenance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    maintenance_type TEXT NOT NULL, -- 'Óleo', 'Pneus', 'Alinhamento', 'Balanceamento', 'Outros'
    performed_at_km INTEGER NOT NULL,
    performed_date DATE DEFAULT CURRENT_DATE NOT NULL,
    next_planned_km INTEGER,
    notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_history TO authenticated;
GRANT ALL ON public.maintenance_history TO service_role;
ALTER TABLE public.maintenance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can select maintenance history" ON public.maintenance_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert maintenance history" ON public.maintenance_history FOR INSERT TO authenticated WITH CHECK (true);

-- Adicionar colunas de odômetro nas viagens
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_requests' AND column_name = 'odometer_start') THEN
        ALTER TABLE public.trip_requests ADD COLUMN odometer_start INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_requests' AND column_name = 'odometer_end') THEN
        ALTER TABLE public.trip_requests ADD COLUMN odometer_end INTEGER;
    END IF;
END $$;
