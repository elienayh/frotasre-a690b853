import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { dayRange } from "@/lib/escala";
import type { Database } from "@/integrations/supabase/types";

export type ScheduleRow = Database["public"]["Tables"]["daily_schedules"]["Row"];
export type AssignmentRow = Database["public"]["Tables"]["schedule_assignments"]["Row"];

export interface AssignmentWithTrip extends AssignmentRow {
  trip: {
    id: string;
    code: number;
    requester_id: string | null;
    requester_name: string | null;
    passengers: number;
    occupants_names: string | null;
    purpose: string;
    destination_text: string;
    departure_at: string;
    return_at: string;
    status: string;
  } | null;
}

export interface ScheduleWithData extends ScheduleRow {
  vehicle: {
    id: string;
    plate: string;
    manufacturer: string;
    model: string;
    capacity: number;
    base_status: string;
  } | null;
  driver: { id: string; full_name: string; profile_id: string | null } | null;
  driver_user: { id: string; full_name: string } | null;
  assignments: AssignmentWithTrip[];
}

const SCHEDULE_SELECT = `
  *,
  vehicle:vehicles(id, plate, manufacturer, model, capacity, base_status),
  driver:drivers(id, full_name, profile_id),
  driver_user:profiles!daily_schedules_driver_user_id_fkey(id, full_name),
  assignments:schedule_assignments(
    *,
    trip:trip_requests(
      id, code, requester_id, requester_name, passengers, occupants_names,
      purpose, destination_text, departure_at, return_at, status
    )
  )
`;

/** Escalas de um dia, com veículo, motorista e atendimentos ordenados. */
export function useDaySchedules(date: string) {
  return useQuery({
    queryKey: ["daily-schedules", date],
    queryFn: async (): Promise<ScheduleWithData[]> => {
      const { data, error } = await supabase
        .from("daily_schedules")
        .select(SCHEDULE_SELECT)
        .eq("schedule_date", date)
        .order("code");
      if (error) throw error;
      const rows = (data ?? []) as unknown as ScheduleWithData[];
      for (const row of rows) {
        row.assignments = [...(row.assignments ?? [])].sort(
          (a, b) =>
            a.order_index - b.order_index ||
            a.scheduled_departure.localeCompare(b.scheduled_departure),
        );
      }
      return rows;
    },
  });
}

/** Uma escala específica (usada na ficha e na visão do motorista). */
export function useSchedule(scheduleId: string | null) {
  return useQuery({
    queryKey: ["daily-schedule", scheduleId],
    enabled: Boolean(scheduleId),
    queryFn: async (): Promise<ScheduleWithData | null> => {
      const { data, error } = await supabase
        .from("daily_schedules")
        .select(SCHEDULE_SELECT)
        .eq("id", scheduleId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as ScheduleWithData;
      row.assignments = [...(row.assignments ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      );
      return row;
    },
  });
}

export interface DayTrip {
  id: string;
  code: number;
  requester_id: string | null;
  requester_name: string | null;
  passengers: number;
  occupants_names: string | null;
  purpose: string;
  destination_text: string;
  city_text: string | null;
  departure_at: string;
  return_at: string;
  status: string;
  needs_sre_driver: boolean;
  vehicle_id: string | null;
  sector: string | null;
  rides: number;
  ridePeople: string[];
  scheduledCount: number;
}

const ORGANIZABLE = ["APROVADA", "PROGRAMADA", "EM_ANDAMENTO"] as const;

/** Solicitações aprovadas do dia, com caronas aprovadas e quantos atendimentos já possuem. */
export function useDayTrips(date: string) {
  return useQuery({
    queryKey: ["day-trips", date],
    queryFn: async (): Promise<DayTrip[]> => {
      const { start, end } = dayRange(date);
      const { data, error } = await supabase
        .from("trip_requests")
        .select(
          `id, code, requester_id, requester_name, passengers, occupants_names, purpose,
           destination_text, city_text, departure_at, return_at, status, needs_sre_driver, vehicle_id,
           requester:profiles!trip_requests_requester_id_fkey(sector),
           rides:ride_requests(id, seats, status, requester:profiles!ride_requests_requester_id_fkey(full_name))`,
        )
        .gte("departure_at", start)
        .lt("departure_at", end)
        .in("status", ORGANIZABLE)
        .order("departure_at");
      if (error) throw error;

      const trips = (data ?? []) as unknown as (DayTrip & {
        requester: { sector: string | null } | null;
        rides: {
          id: string;
          seats: number;
          status: string;
          requester: { full_name: string } | null;
        }[];
      })[];

      const ids = trips.map((t) => t.id);
      let counts = new Map<string, number>();
      if (ids.length) {
        const { data: assigned, error: assignedError } = await supabase
          .from("schedule_assignments")
          .select("trip_id, status")
          .in("trip_id", ids)
          .neq("status", "CANCELADO");
        if (assignedError) throw assignedError;
        counts = (assigned ?? []).reduce((acc, row) => {
          if (row.trip_id) acc.set(row.trip_id, (acc.get(row.trip_id) ?? 0) + 1);
          return acc;
        }, new Map<string, number>());
      }

      return trips.map((trip) => {
        const approved = (trip.rides ?? []).filter((r) => r.status === "APROVADA");
        return {
          ...trip,
          sector: trip.requester?.sector ?? null,
          rides: approved.reduce((sum, r) => sum + (r.seats ?? 1), 0),
          ridePeople: approved.map((r) => r.requester?.full_name ?? "Carona"),
          scheduledCount: counts.get(trip.id) ?? 0,
        };
      });
    },
  });
}

/** Histórico de alterações de uma escala. */
export function useScheduleHistory(scheduleId: string | null) {
  return useQuery({
    queryKey: ["schedule-history", scheduleId],
    enabled: Boolean(scheduleId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_history")
        .select("*, user:profiles(full_name)")
        .eq("schedule_id", scheduleId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        action: string;
        field_changed: string | null;
        old_value: string | null;
        new_value: string | null;
        created_at: string;
        user: { full_name: string } | null;
      }[];
    },
  });
}

/** Ocorrências registradas na escala. */
export function useScheduleIncidents(scheduleId: string | null) {
  return useQuery({
    queryKey: ["schedule-incidents", scheduleId],
    enabled: Boolean(scheduleId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_incidents")
        .select("*, user:profiles(full_name)")
        .eq("schedule_id", scheduleId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        kind: string;
        description: string;
        created_at: string;
        user: { full_name: string } | null;
      }[];
    },
  });
}

/** Motoristas cadastrados e ativos, para montar a escala. */
export function useDriverOptions() {
  return useQuery({
    queryKey: ["driver-options-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, cnh_expires_at, is_sre_driver")
        .eq("is_active", true)
        .eq("is_sre_driver", true)
        .order("full_name");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        profile_id: p.id,
        cnh_expires_at: p.cnh_expires_at as string | null,
      }));
    },
    staleTime: 60_000,
  });
}

/** Registra uma linha no histórico da escala (nunca falha a operação principal). */
export async function logScheduleChange(entry: {
  scheduleId: string;
  assignmentId?: string | null;
  userId: string | null;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}): Promise<void> {
  if (!entry.userId) return;
  await supabase.from("schedule_history").insert({
    schedule_id: entry.scheduleId,
    assignment_id: entry.assignmentId ?? null,
    user_id: entry.userId,
    action: entry.action,
    field_changed: entry.field ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
  });
}

/** Dispara notificações pelo sino já existente. */
export async function notifyUsers(
  userIds: (string | null | undefined)[],
  title: string,
  body: string,
  tripId?: string | null,
): Promise<void> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (!ids.length) return;
  const args = {
    _user_ids: ids,
    _title: title,
    _body: body,
    _trip_id: tripId ?? null,
  } as unknown as { _user_ids: string[]; _title: string; _body: string };
  await supabase.rpc("notify_users", args);
}

export interface ConflictRow {
  kind: string;
  assignment_id: string;
  schedule_id: string;
  schedule_code: number;
  label: string;
  starts_at: string;
  ends_at: string;
}

interface ConflictParams {
  vehicleId: string | null;
  driverId: string | null;
  driverUserId: string | null;
  start: string;
  end: string;
  excludeAssignment?: string | null;
}

/** Os parâmetros opcionais do banco aceitam nulo; o tipo gerado exige string. */
function conflictArgs(params: ConflictParams) {
  return {
    _vehicle_id: params.vehicleId,
    _driver_id: params.driverId,
    _driver_user_id: params.driverUserId,
    _start: params.start,
    _end: params.end,
    _exclude_assignment: params.excludeAssignment ?? null,
  } as unknown as {
    _vehicle_id: string;
    _driver_id: string;
    _driver_user_id: string;
    _start: string;
    _end: string;
  };
}

/** Conflitos de veículo/motorista em um intervalo. */
export async function findConflicts(params: ConflictParams): Promise<ConflictRow[]> {
  const { data, error } = await supabase.rpc("schedule_conflicts", conflictArgs(params));
  if (error) throw error;
  return (data ?? []) as ConflictRow[];
}

/** Sugestão do próximo horário livre mantendo a duração. */
export async function suggestFreeSlot(params: ConflictParams): Promise<string | null> {
  const { data, error } = await supabase.rpc("suggest_free_slot", conflictArgs(params));
  if (error) throw error;
  return (data as string | null) ?? null;
}
