import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TripForm } from "@/components/TripForm";

export const Route = createFileRoute("/_authenticated/solicitacoes/$tripId/editar")({
  component: EditarSolicitacao,
});

function EditarSolicitacao() {
  const { tripId } = Route.useParams();

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

  return (
    <AppShell
      title="Editar Solicitação"
      description="Ajuste os dados e reenvie o pedido para análise do DAFI."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !trip ? (
        <p className="text-sm text-muted-foreground">Solicitação não encontrada.</p>
      ) : (
        <TripForm trip={trip} />
      )}
    </AppShell>
  );
}
