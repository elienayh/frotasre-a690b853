import { createFileRoute, useSearch } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { TripForm } from "@/components/TripForm";

export const Route = createFileRoute("/_authenticated/solicitacoes/nova")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      initialDate: (search as any).initialDate as string | undefined,
    };
  },
  component: NovaSolicitacao,
});

function NovaSolicitacao() {
  const search = useSearch({ from: "/_authenticated/solicitacoes/nova" });
  return (
    <AppShell
      title="Nova Solicitação de Viagem"
      description={`Informe data, horários, destino e ocupantes. ${search?.initialDate ? `Data pré-preenchida: ${search.initialDate}` : "A DAFI define o veículo."}`}
    >
      <TripForm />
    </AppShell>
  );
}
