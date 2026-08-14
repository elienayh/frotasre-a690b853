import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate, fmtTime } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/viagens")({
  component: MinhasViagens,
});

function MinhasViagens() {
  const { user } = useAuth();

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["my-scheduled", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(
          "id, code, destination_text, departure_at, return_at, status, passengers, pw_number, vehicles(plate, manufacturer, model), assigned:profiles!trip_requests_assigned_driver_user_id_fkey(full_name, mobile, phone)",
        )
        .eq("requester_id", user!.id)
        .in("status", ["APROVADA", "PROGRAMADA", "EM_ANDAMENTO", "CONCLUIDA"])
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell
      title="Minhas Viagens"
      description="Viagens aprovadas com veículo e motorista definidos pela DAFI."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : trips.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma viagem aprovada até o momento.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {trips.map((t) => (
            <li key={t.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold">{t.destination_text}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmtDate(t.departure_at)} · {fmtTime(t.departure_at)} — {fmtTime(t.return_at)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Veículo</dt>
                  <dd>
                    {t.vehicles
                      ? `${t.vehicles.manufacturer} ${t.vehicles.model} — ${t.vehicles.plate}`
                      : "A definir"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Motorista</dt>
                  <dd>{t.assigned?.full_name ?? "A definir"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Registro PW</dt>
                  <dd>{t.pw_number ?? "Pendente na DAFI"}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
