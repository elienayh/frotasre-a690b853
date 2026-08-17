import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface TripStopRow {
  id: string;
  position: number;
  city_id: string | null;
  city_text: string | null;
  destination_id: string | null;
  place_text: string | null;
  driver_user_id: string | null;
  cities: { name: string } | null;
  destinations: { name: string } | null;
  driver: { full_name: string } | null;
}

const STOP_SELECT = `
  id, position, city_id, city_text, destination_id, place_text, driver_user_id,
  cities(name),
  destinations(name),
  driver:profiles!trip_stops_driver_user_id_fkey(full_name)
`;

/** Paradas de uma viagem, com cidade, local e motorista de cada trecho. */
export function useTripStops(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ["trip-stops-full", tripId],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<TripStopRow[]> => {
      const { data, error } = await supabase
        .from("trip_stops")
        .select(STOP_SELECT)
        .eq("trip_id", tripId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as TripStopRow[];
    },
  });
}

/** Rótulo "Local · Cidade" de uma parada já persistida. */
export function stopRowLabel(stop: TripStopRow): string {
  const place = stop.destinations?.name ?? stop.place_text ?? "";
  const city = stop.cities?.name ?? stop.city_text ?? "";
  if (place && city) return `${place} · ${city}`;
  return place || city || "Destino não informado";
}

/** Nome do motorista do trecho — "DAFI DEFINIR" enquanto não houver definição. */
export function stopDriverName(stop: TripStopRow): string {
  return stop.driver?.full_name ?? "DAFI DEFINIR";
}

/** Define o motorista de um trecho específico. */
export function useSetStopDriver(tripId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stopId, driverId }: { stopId: string; driverId: string | null }) => {
      const { error } = await supabase
        .from("trip_stops")
        .update({ driver_user_id: driverId })
        .eq("id", stopId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trip-stops-full", tripId] });
    },
  });
}
