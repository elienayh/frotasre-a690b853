import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { TripForm } from "@/components/TripForm";


export const Route = createFileRoute("/_authenticated/solicitacoes/$tripId/editar")({
  component: EditarSolicitacao,
});

function EditarSolicitacao() {
  const { tripId } = Route.useParams();
  const { user, isAdmin, isSuperAdmin, isCoordinator } = useAuth();

  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select("*")
        .eq("id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // O solicitante pode editar enquanto a viagem aguarda análise; após a
  // aprovação valem as regras atuais (somente DAFI/administração).
  const pending = trip ? ["PENDENTE", "CORRECAO"].includes(trip.status) : false;
  const isOwner = Boolean(trip && user && trip.requester_id === user.id);
  const canEdit = isAdmin || isSuperAdmin || ((isOwner || isCoordinator) && pending);

  return (
    <AppShell
      title="Editar Solicitação"
      description="Ajuste os dados e reenvie o pedido para análise da DAFI."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !trip ? (
        <p className="text-sm text-muted-foreground">Solicitação não encontrada.</p>
      ) : !canEdit ? (
        <p className="text-sm text-muted-foreground">
          Esta solicitação já foi analisada e não pode mais ser editada por você. Fale com a
          DAFI para qualquer ajuste.
        </p>
      ) : (
        <TripForm trip={trip} />
      )}
    </AppShell>
  );
}

