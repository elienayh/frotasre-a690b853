import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/frota";

/** Destino vinculado a um ocupante específico da viagem. */
export interface OccupantDestinationRow {
  id: string;
  occupant_id: string;
  destination_id: string;
  destination: { id: string; name: string; city: string | null } | null;
}

const SELECT = "id, occupant_id, destination_id, destination:destinations(id, name, city)";

/** Vínculos de destinos por ocupante de uma viagem. */
export function useOccupantDestinations(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ["occupant-destinations", tripId],
    enabled: Boolean(tripId),
    queryFn: async (): Promise<OccupantDestinationRow[]> => {
      const { data, error } = await supabase
        .from("trip_occupant_destinations")
        .select(SELECT)
        .eq("trip_id", tripId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as OccupantDestinationRow[];
    },
  });
}

export interface LinkDestinationInput {
  occupantId: string;
  /** Destino já cadastrado. */
  destinationId?: string | null;
  /** Nome digitado quando o destino ainda não existe. */
  name?: string | null;
}

/**
 * Localiza um destino pelo nome (sem diferenciar maiúsculas) e, se não existir,
 * cria um novo registro reutilizando a tabela `destinations` existente.
 */
export async function resolveDestinationId(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Informe o nome do destino.");

  const { data: found, error: findError } = await supabase
    .from("destinations")
    .select("id")
    .ilike("name", trimmed)
    .limit(1);
  if (findError) throw new Error(friendlyDbError(findError.message));
  if (found && found.length > 0 && found[0]) return found[0].id;

  const { data: created, error: createError } = await supabase
    .from("destinations")
    .insert({ name: trimmed })
    .select("id")
    .single();
  if (createError) throw new Error(friendlyDbError(createError.message));
  return created.id;
}

export function useOccupantDestinationMutations(tripId: string | null | undefined) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["occupant-destinations", tripId] });
    void queryClient.invalidateQueries({ queryKey: ["places"] });
  };

  const link = useMutation({
    mutationFn: async (input: LinkDestinationInput) => {
      if (!tripId) throw new Error("Viagem não identificada.");
      const destinationId = input.destinationId ?? (await resolveDestinationId(input.name ?? ""));
      const { data: session } = await supabase.auth.getUser();
      const { error } = await supabase.from("trip_occupant_destinations").insert({
        trip_id: tripId,
        occupant_id: input.occupantId,
        destination_id: destinationId,
        created_by: session.user?.id ?? null,
      });
      // Vínculo duplicado é ignorado silenciosamente (mesma pessoa, mesmo destino).
      if (error && !error.message.includes("duplicate key")) {
        throw new Error(friendlyDbError(error.message));
      }
    },
    onSuccess: () => {
      toast.success("Destino vinculado ao ocupante.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trip_occupant_destinations").delete().eq("id", id);
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Destino desvinculado.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { link, unlink };
}
