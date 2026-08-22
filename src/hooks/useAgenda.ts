import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { calculateSeats, type SeatInfo } from "@/lib/occupancy";

const TRIP_SELECT = `
  id, code, status, departure_at, return_at, destination_text, purpose, passengers,
  occupants_names, requester_name, requester_id, allows_rides, admin_notes, requester_notes,
  needs_sre_driver, requested_driver_id, vehicle_id, assigned_driver_user_id, city_id, city_text,
  odometer_start, odometer_end,
  cities(name),
  vehicles(id, plate, manufacturer, model, capacity),
  drivers(full_name),
  requester:profiles!trip_requests_requester_id_fkey(full_name, sector),
  assigned:profiles!trip_requests_assigned_driver_user_id_fkey(full_name),
  approver:profiles!trip_requests_approved_by_fkey(full_name),
  organizer:profiles!trip_requests_organized_by_fkey(full_name),
  approved_at, organized_at, rejection_reason,
  trip_stops(position, place_text, city_text, driver_user_id, destination:destinations(name), city:cities(name)),
  trip_occupants(user_id, is_external, is_driver, status)
`;


export interface AgendaTrip {
  id: string;
  code: number;
  status: string;
  departure_at: string;
  return_at: string;
  destination_text: string;
  purpose: string;
  passengers: number;
  occupants_names: string | null;
  requester_name: string | null;
  requester_id: string | null;
  allows_rides: boolean;
  admin_notes: string | null;
  requester_notes: string | null;
  needs_sre_driver: boolean;
  requested_driver_id: string | null;
  vehicle_id: string | null;
  assigned_driver_user_id: string | null;
  city_id: string | null;
  city_text: string | null;
  cities: { name: string } | null;
  vehicles: {
    id: string;
    plate: string;
    manufacturer: string;
    model: string;
    capacity: number;
  } | null;
  drivers: { full_name: string } | null;
  requester: { full_name: string; sector: string | null } | null;
  assigned: { full_name: string } | null;
  approver: { full_name: string } | null;
  organizer: { full_name: string } | null;
  approved_at: string | null;
  organized_at: string | null;
  rejection_reason: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  trip_stops: {
    position: number;
    place_text: string | null;
    city_text: string | null;
    driver_user_id: string | null;
    destination: { name: string } | null;
    city: { name: string } | null;
  }[] | null;
  trip_occupants: {
    user_id: string | null;
    is_external: boolean | null;
    is_driver: boolean | null;
    status: string | null;
  }[] | null;
}

/**
 * Lista ordenada e sem repetições dos destinos reais da viagem.
 * Deriva dos trechos cadastrados; usa o destino textual da solicitação
 * apenas quando não existirem trechos.
 */
export function tripDestinations(trip: AgendaTrip): string[] {
  const stops = [...(trip.trip_stops ?? [])].sort((a, b) => a.position - b.position);
  const names = stops
    .map((s) => s.destination?.name ?? s.place_text ?? s.city?.name ?? s.city_text ?? "")
    .map((n) => n.trim())
    .filter(Boolean);

  const unique: string[] = [];
  names.forEach((n) => {
    if (unique[unique.length - 1] !== n && !unique.includes(n)) unique.push(n);
  });

  if (unique.length > 0) return unique;
  return trip.destination_text ? [trip.destination_text] : [];
}

/** Vagas disponíveis da viagem, usando a regra central de ocupação. */
export function tripSeats(trip: AgendaTrip): SeatInfo {
  return calculateSeats(trip.trip_occupants, trip.trip_stops, trip.vehicles?.capacity);
}


/** Nome da cidade principal da viagem (cadastrada ou digitada). */
export function tripCity(trip: AgendaTrip): string {
  return trip.cities?.name ?? trip.city_text ?? "—";
}

/** Nome de quem irá dirigir, considerando o fluxo de motorista da SRE. */
export function tripDriverName(trip: AgendaTrip): string {
  return (
    trip.assigned?.full_name ??
    (trip.needs_sre_driver ? "Motorista da SRE a definir" : "Motorista a definir")
  );
}

/** Viagens dentro de um intervalo, com veículo, condutor e setor do solicitante. */
export function useAgendaTrips(startIso: string, endIso: string) {
  return useQuery({
    queryKey: ["agenda-trips", startIso, endIso],
    queryFn: async (): Promise<AgendaTrip[]> => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(TRIP_SELECT)
        .gte("departure_at", startIso)
        .lt("departure_at", endIso)
        .not("status", "in", "(REJEITADA,CANCELADA)")
        .order("departure_at");
      if (error) throw error;
      return (data ?? []) as unknown as AgendaTrip[];
    },
  });
}

/** Uma viagem específica, usada no painel lateral de detalhes. */
export function useAgendaTrip(tripId: string | null) {
  return useQuery({
    queryKey: ["agenda-trip", tripId],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<AgendaTrip | null> => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(TRIP_SELECT)
        .eq("id", tripId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AgendaTrip) ?? null;
    },
  });
}
