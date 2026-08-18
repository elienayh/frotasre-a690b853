-- Fase 4: Ciclo de Vida do Veículo e Fase 5: Segurança/Auditoria

-- 1. Alterações na tabela vehicles
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS next_preventive_km integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS preventive_km_interval integer DEFAULT 10000;

-- 2. Trigger para atualizar odômetro ao abastecer
CREATE OR REPLACE FUNCTION public.update_vehicle_odometer_on_fuel()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.odometer IS NOT NULL) THEN
        UPDATE public.vehicles 
        SET odometer = GREATEST(odometer, NEW.odometer)
        WHERE id = NEW.vehicle_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_update_vehicle_odometer_on_fuel ON public.fuel_records;
CREATE TRIGGER tr_update_vehicle_odometer_on_fuel
AFTER INSERT OR UPDATE ON public.fuel_records
FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_odometer_on_fuel();

-- 3. Trigger para notificar manutenção preventiva
CREATE OR REPLACE FUNCTION public.check_preventive_maintenance()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Se o odômetro atingiu ou está perto (90%) da manutenção preventiva
    IF (NEW.odometer >= (NEW.next_preventive_km - 500)) THEN
        -- Busca administradores para notificar
        FOR v_admin_id IN 
            SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'super_admin')
        LOOP
            INSERT INTO public.notifications (user_id, title, body, type, entity_id, entity_type)
            VALUES (
                v_admin_id,
                'Manutenção Preventiva: ' || NEW.plate,
                'O veículo ' || NEW.manufacturer || ' ' || NEW.model || ' (Placa ' || NEW.plate || ') atingiu ' || NEW.odometer || 'km e necessita de manutenção preventiva.',
                'SYSTEM',
                NEW.id,
                'VEHICLE'
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_preventive_maintenance ON public.vehicles;
CREATE TRIGGER tr_check_preventive_maintenance
AFTER UPDATE OF odometer ON public.vehicles
FOR EACH ROW WHEN (OLD.odometer IS DISTINCT FROM NEW.odometer)
EXECUTE FUNCTION public.check_preventive_maintenance();

-- 4. Função para resetar manutenção preventiva (chamada ao finalizar uma manutenção km)
CREATE OR REPLACE FUNCTION public.reset_preventive_km(p_vehicle_id uuid, p_current_km integer)
RETURNS void AS $$
BEGIN
    UPDATE public.vehicles
    SET next_preventive_km = p_current_km + preventive_km_interval
    WHERE id = p_vehicle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Refinamento de RLS (Fase 5)
-- Garantir que coordenadores vejam apenas viagens do seu setor
DROP POLICY IF EXISTS "Coordinators can view sector trips" ON public.trip_requests;
CREATE POLICY "Coordinators can view sector trips"
ON public.trip_requests
FOR SELECT
TO authenticated
USING (
    (public.has_role(auth.uid(), 'admin')) OR 
    (public.has_role(auth.uid(), 'super_admin')) OR
    (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
              AND is_coordinator = true 
              AND sector = (SELECT sector FROM public.profiles WHERE id = trip_requests.requester_id)
        )
    ) OR
    (requester_id = auth.uid()) OR
    (assigned_driver_user_id = auth.uid())
);

-- 6. Garantir permissões para super_admin em tudo
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_history TO authenticated;
