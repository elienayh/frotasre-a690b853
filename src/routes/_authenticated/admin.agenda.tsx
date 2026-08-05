import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtDate, fmtTime, todayInput } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/admin/agenda")({
  component: AgendaFrota,
});

function AgendaFrota() {
  const [from, setFrom] = useState(todayInput());
  const [days, setDays] = useState(7);

  const startIso = new Date(`${from}T00:00`).toISOString();
  const endIso = new Date(
    new Date(`${from}T00:00`).getTime() + days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["fleet-agenda", startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(
          "id, code, destination_text, departure_at, return_at, status, passengers, requester_name, vehicles(plate, manufacturer, model), drivers(full_name)",
        )
        .gte("departure_at", startIso)
        .lt("departure_at", endIso)
        .not("status", "in", "(REJEITADA,CANCELADA)")
        .order("departure_at");
      if (error) throw error;
      return data;
    },
  });

  const grouped = trips.reduce<Record<string, typeof trips>>((acc, trip) => {
    const key = fmtDate(trip.departure_at);
    (acc[key] ||= []).push(trip);
    return acc;
  }, {});

  return (
    <AppShell
      title="Agenda da Frota"
      description="Todas as viagens programadas por dia, com veículo e motorista."
    >
      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="a-from">A partir de</Label>
          <Input id="a-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="a-days">Dias exibidos</Label>
          <Input
            id="a-days"
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 7)}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma viagem no período selecionado.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {Object.entries(grouped).map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-3 font-display text-base font-semibold">{day}</h2>
              <ul className="grid gap-3">
                {items.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
                  >
                    <div>
                      <p className="font-medium">
                        {fmtTime(t.departure_at)} — {fmtTime(t.return_at)} · {t.destination_text}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t.vehicles
                          ? `${t.vehicles.manufacturer} ${t.vehicles.model} (${t.vehicles.plate})`
                          : "Veículo a definir"}
                        {" · "}
                        {t.drivers?.full_name ?? "Motorista a definir"}
                        {" · "}
                        {t.requester_name ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={t.status} />
                      <Link
                        to="/admin/solicitacoes"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Gerenciar
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
