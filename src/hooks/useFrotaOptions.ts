import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface CityOption {
  id: string;
  name: string;
  is_active: boolean;
}

export interface PlaceOption {
  id: string;
  name: string;
  city: string | null;
  city_id: string | null;
  address: string | null;
  place_type: string | null;
  is_active: boolean;
}

export interface PersonOption {
  id: string;
  full_name: string;
  sector: string | null;
  registration: string | null;
  is_sre_driver: boolean;
  is_driver_certified: boolean;
  is_active: boolean;
}


/** Cidades cadastradas (todas para o admin; a UI filtra as inativas quando necessário). */
export function useCities(onlyActive = true) {
  return useQuery({
    queryKey: ["cities", onlyActive],
    queryFn: async (): Promise<CityOption[]> => {
      let query = supabase.from("cities").select("id, name, is_active").order("name");
      if (onlyActive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/** Locais de destino cadastrados, com a cidade relacionada. */
export function usePlaces(onlyActive = true) {
  return useQuery({
    queryKey: ["places", onlyActive],
    queryFn: async (): Promise<PlaceOption[]> => {
      let query = supabase
        .from("destinations")
        .select("id, name, city, city_id, address, place_type, is_active")
        .order("name");
      if (onlyActive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/** Usuários ativos, usados na indicação e na definição do condutor. */
export function usePeople() {
  return useQuery({
    queryKey: ["people-active"],
    queryFn: async (): Promise<PersonOption[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, sector, registration, is_sre_driver, is_driver_certified, is_active",
        )

        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}
