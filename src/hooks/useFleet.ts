import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface VehicleOption {
  id: string;
  plate: string;
  manufacturer: string;
  model: string;
  capacity: number;
  base_status: string;
  is_active: boolean;
  photo_url: string | null;
}

/** Veículos cadastrados (todos, para filtros e agenda). */
export function useVehicles(onlyActive = false) {
  return useQuery({
    queryKey: ["vehicles-options", onlyActive],
    queryFn: async (): Promise<VehicleOption[]> => {
      let query = supabase
        .from("vehicles")
        .select("id, plate, manufacturer, model, capacity, base_status, is_active, photo_url")
        .order("plate");
      if (onlyActive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as VehicleOption[];
    },
    staleTime: 30_000,
  });
}

/** Situação instantânea da frota calculada no banco. */
export function useFleetNow() {
  return useQuery({
    queryKey: ["fleet-now"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fleet_now");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}

/** Disponibilidade da frota em um intervalo de data/hora. */
export function useFleetAvailability(startIso: string, endIso: string, passengers = 0) {
  return useQuery({
    queryKey: ["fleet-availability", startIso, endIso, passengers],
    enabled: Boolean(startIso && endIso && endIso > startIso),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fleet_availability", {
        p_start: startIso,
        p_end: endIso,
        p_passengers: passengers,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}
