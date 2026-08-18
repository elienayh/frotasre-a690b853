import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/frota";

export interface OccupantRow {
  id: string;
  trip_id: string;
  user_id: string | null;
  is_external: boolean;
  is_driver: boolean;
  external_name: string | null;
  external_document: string | null;
  external_phone: string | null;
  notes: string | null;
  status: string;
  declined_at: string | null;
  profile: { full_name: string; sector: string | null; registration: string | null } | null;
}

const SELECT =
  "id, trip_id, user_id, is_external, is_driver, external_name, external_document, external_phone, notes, status, declined_at, profile:profiles!trip_occupants_user_id_fkey(full_name, sector, registration)";

/** Ocupantes vinculados a uma viagem (usuários do sistema e externos). */
export function useTripOccupants(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ["trip-occupants", tripId],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<OccupantRow[]> => {
      const { data, error } = await supabase
        .from("trip_occupants")
        .select(SELECT)
        .eq("trip_id", tripId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as OccupantRow[];
    },
  });
}

/** Nome apresentável de um ocupante, com marcação de externo. */
export function occupantName(occupant: OccupantRow): string {
  return occupant.is_external
    ? (occupant.external_name ?? "Ocupante externo")
    : (occupant.profile?.full_name ?? "Usuário");
}

export interface NewOccupantInput {
  tripId: string;
  userId?: string | null;
  external?: {
    name: string;
    document?: string | null;
    phone?: string | null;
    notes?: string | null;
  };
}

export function useOccupantMutations(tripId: string | null | undefined) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["trip-occupants", tripId] });
    void queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
  };

  const add = useMutation({
    mutationFn: async (input: NewOccupantInput) => {
      const { data: session } = await supabase.auth.getUser();
      const { error } = await supabase.from("trip_occupants").insert({
        trip_id: input.tripId,
        user_id: input.userId ?? null,
        is_external: Boolean(input.external),
        external_name: input.external?.name ?? null,
        external_document: input.external?.document ?? null,
        external_phone: input.external?.phone ?? null,
        notes: input.external?.notes ?? null,
        added_by: session.user?.id ?? null,
      });
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Ocupante incluído.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trip_occupants").delete().eq("id", id);
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Ocupante removido.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decline = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("trip_occupants")
        .update({ status: "RECUSADO", declined_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Registramos que você não participará desta viagem.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { add, remove, decline };
}
