import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { TripForm } from "@/components/TripForm";

export const Route = createFileRoute("/_authenticated/solicitacoes/nova")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      initialDate: search.initialDate as string | undefined,
    };
  },
  component: NovaSolicitacao,
});

function NovaSolicitacao() {
  return (
    <AppShell
      title="Nova Solicitação de Viagem"
      description="Informe data, horários, destino e ocupantes. A DAFI define o veículo."
    >
      <TripForm />
    </AppShell>
  );
}
