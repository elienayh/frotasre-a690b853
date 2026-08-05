import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtTime } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/setor")({
  component: ViagensDoSetor,
});

function ViagensDoSetor() {
  const { profile, isCoordinator } = useAuth();
  const sector = profile?.sector ?? null;

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["sector-trips", sector],
    enabled: Boolean(sector) && isCoordinator,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(
          "id, code, destination_text, purpose, passengers, departure_at, return_at, status, requester_name, profiles!trip_requests_requester_id_fkey!inner(full_name, sector)",
        )
        .eq("profiles.sector", sector!)
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!isCoordinator) {
    return (
      <AppShell title="Viagens do Setor">
        <p className="text-sm text-muted-foreground">
          Esta área é exclusiva dos coordenadores de setor.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Viagens do Setor · ${sector ?? "—"}`}
      description="Como coordenador, você acompanha e edita as solicitações pendentes do seu setor."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : trips.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma solicitação do setor.
        </p>
      ) : (
        <ul className="grid gap-4">
          {trips.map((t) => {
            const editable = ["PENDENTE", "CORRECAO"].includes(t.status);
            return (
              <li key={t.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold">
                      #{t.code} · {t.destination_text}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.profiles?.full_name ?? t.requester_name ?? "Servidor"} ·{" "}
                      {fmtDate(t.departure_at)} · saída {fmtTime(t.departure_at)} · retorno{" "}
                      {fmtTime(t.return_at)} · {t.passengers} ocupante(s)
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.purpose}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={t.status} />
                    {editable ? (
                      <Button asChild variant="outline" size="sm">
                        <Link to="/solicitacoes/$tripId/editar" params={{ tripId: t.id }}>
                          <Pencil className="mr-1 h-4 w-4" /> Editar
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
