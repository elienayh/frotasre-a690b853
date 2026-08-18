import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PendingCounts {
  approvals: number;
  vehicles: number;
  users: number;
}

export function usePendingCounts() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: counts = { approvals: 0, vehicles: 0, users: 0 } } = useQuery({
    queryKey: ["pending-counts", user?.id],
    enabled: Boolean(user?.id && isAdmin),
    queryFn: async (): Promise<PendingCounts> => {
      // 1. APROVAÇÕES: Solicitações de viagem PENDENTES + Pedidos de carona PENDENTES
      const [tripsRes, ridesRes, vehiclesRes, usersRes] = await Promise.all([
        supabase
          .from("trip_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDENTE"),
        supabase
          .from("ride_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDENTE"),
        // 2. VEÍCULOS: Manutenção vencida ou crítica
        supabase
          .from("vehicles")
          .select("id")
          .or("maintenance_status.eq.VENCIDA,maintenance_status.eq.CRÍTICO"),
        // 3. USUÁRIOS: Inativos (aguardando ativação)
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", false),
      ]);

      return {
        approvals: (tripsRes.count || 0) + (ridesRes.count || 0),
        // Para veículos, o count exato via PostgREST head pode ser limitado se usarmos or,
        // mas aqui estamos pegando os IDs e contando os únicos.
        vehicles: new Set((vehiclesRes.data || []).map(v => v.id)).size,
        users: usersRes.count || 0,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache, mas invalidaremos via Realtime
  });

  // Realtime updates
  useEffect(() => {
    if (!user?.id || !isAdmin) return;

    const channels = [
      supabase
        .channel("pending-trips")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "trip_requests" },
          () => queryClient.invalidateQueries({ queryKey: ["pending-counts"] })
        )
        .subscribe(),
      supabase
        .channel("pending-rides")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ride_requests" },
          () => queryClient.invalidateQueries({ queryKey: ["pending-counts"] })
        )
        .subscribe(),
      supabase
        .channel("pending-vehicles")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "vehicles" },
          () => queryClient.invalidateQueries({ queryKey: ["pending-counts"] })
        )
        .subscribe(),
      supabase
        .channel("pending-users")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles" },
          () => queryClient.invalidateQueries({ queryKey: ["pending-counts"] })
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [user?.id, isAdmin, queryClient]);

  return counts;
}
