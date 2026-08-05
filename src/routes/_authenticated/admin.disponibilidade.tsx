import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateTimeToIso, fmtDateTime, todayInput } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/admin/disponibilidade")({
  component: Disponibilidade,
});

function Disponibilidade() {
  const [date, setDate] = useState(todayInput());
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [passengers, setPassengers] = useState(1);

  const startIso = dateTimeToIso(date, start);
  const endIso = dateTimeToIso(date, end);
  const validRange = endIso > startIso;

  const { data = [], isLoading } = useQuery({
    queryKey: ["availability", startIso, endIso, passengers],
    enabled: validRange,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fleet_availability", {
        p_start: startIso,
        p_end: endIso,
        p_passengers: passengers,
      });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell
      title="Disponibilidade da Frota"
      description="Consulte quais veículos estão livres em um período específico."
    >
      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="d-date">Data</Label>
          <Input id="d-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="d-start">Saída</Label>
          <Input id="d-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="d-end">Retorno</Label>
          <Input id="d-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="d-pax">Ocupantes</Label>
          <Input
            id="d-pax"
            type="number"
            min={1}
            max={60}
            value={passengers}
            onChange={(e) => setPassengers(Number(e.target.value) || 1)}
          />
        </div>
      </div>

      {!validRange ? (
        <p className="mt-6 text-sm text-destructive">O retorno deve ser posterior à saída.</p>
      ) : isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Calculando…</p>
      ) : (
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {data.map((v) => (
            <li
              key={v.vehicle_id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <p className="font-display font-semibold">
                  {v.manufacturer} {v.model}
                </p>
                <p className="text-sm text-muted-foreground">
                  {v.plate} · {v.capacity} lugares{v.fuel ? ` · ${v.fuel}` : ""}
                </p>
                {v.detail ? <p className="mt-1 text-sm">{v.detail}</p> : null}
                {v.conflict_start ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Conflito: {fmtDateTime(v.conflict_start)} – {fmtDateTime(v.conflict_end)}
                  </p>
                ) : null}
              </div>
              <Badge variant={v.is_available ? "default" : "destructive"}>
                {v.is_available ? "Disponível" : v.reason}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
