import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TripDrawer } from "@/components/TripDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAgendaTrips, tripCity, tripDriverName } from "@/hooks/useAgenda";
import { useVehicles } from "@/hooks/useFleet";
import { sectorColor } from "@/lib/setores";
import { fmtDate, fmtTime, todayInput } from "@/lib/frota";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/agenda")({
  component: AgendaFrota,
});

const START_HOUR = 6;
const END_HOUR = 20;
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;

function minutesFromStart(iso: string, day: Date): number {
  const d = new Date(iso);
  const base = new Date(day);
  base.setHours(START_HOUR, 0, 0, 0);
  return (d.getTime() - base.getTime()) / 60000;
}

function AgendaFrota() {
  const [day, setDay] = useState(todayInput());
  const [tripId, setTripId] = useState<string | null>(null);

  const dayDate = useMemo(() => new Date(`${day}T00:00`), [day]);
  const startIso = dayDate.toISOString();
  const endIso = useMemo(
    () => new Date(dayDate.getTime() + 24 * 3600 * 1000).toISOString(),
    [dayDate],
  );

  const { data: vehicles = [] } = useVehicles();
  const { data: trips = [], isLoading } = useAgendaTrips(startIso, endIso);

  const shift = (delta: number) => {
    const d = new Date(dayDate.getTime() + delta * 24 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    setDay(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const unassigned = trips.filter((t) => !t.vehicle_id);

  return (
    <AppShell
      title="Agenda da Frota"
      description="Ocupação de cada veículo ao longo do dia."
      actions={
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Dia anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDay(todayInput())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" aria-label="Próximo dia" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="ag-day">Data</Label>
          <Input
            id="ag-day"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value || todayInput())}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {fmtDate(dayDate)} · {isLoading ? "carregando…" : `${trips.length} viagem(ns)`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <div className="min-w-[52rem]">
          <div className="flex border-b border-border bg-muted/50">
            <div className="w-48 shrink-0 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Veículo
            </div>
            <div className="relative flex-1">
              <div className="flex">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="flex-1 border-l border-border px-1 py-2 text-[11px] text-muted-foreground"
                  >
                    {String(h).padStart(2, "0")}h
                  </div>
                ))}
              </div>
            </div>
          </div>

          {vehicles.map((v) => {
            const blocked =
              !v.is_active ||
              v.base_status === "EM_MANUTENCAO" ||
              v.base_status === "INDISPONIVEL";
            const items = trips.filter((t) => t.vehicle_id === v.id);
            return (
              <div key={v.id} className="flex border-b border-border last:border-b-0">
                <div className="w-48 shrink-0 px-3 py-3">
                  <p className="text-sm font-semibold">
                    {v.manufacturer} {v.model}
                  </p>
                  <p className="text-xs text-muted-foreground">{v.plate}</p>
                  {blocked ? (
                    <Badge variant="destructive" className="mt-1 gap-1">
                      <Wrench className="h-3 w-3" />
                      {v.base_status === "EM_MANUTENCAO" ? "Manutenção" : "Indisponível"}
                    </Badge>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "relative min-h-16 flex-1",
                    blocked && "bg-destructive/10 [background-image:repeating-linear-gradient(45deg,transparent,transparent_6px,var(--color-border)_6px,var(--color-border)_7px)]",
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 flex">
                    {hours.map((h) => (
                      <div key={h} className="flex-1 border-l border-border/60" />
                    ))}
                  </div>
                  {items.map((t) => {
                    const from = Math.max(0, minutesFromStart(t.departure_at, dayDate));
                    const to = Math.min(TOTAL_MIN, minutesFromStart(t.return_at, dayDate));
                    if (to <= 0 || from >= TOTAL_MIN) return null;
                    const color = sectorColor(t.requester?.sector);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTripId(t.id)}
                        style={{
                          left: `${(from / TOTAL_MIN) * 100}%`,
                          width: `${Math.max(4, ((to - from) / TOTAL_MIN) * 100)}%`,
                        }}
                        className={cn(
                          "absolute top-2 bottom-2 overflow-hidden rounded border-l-4 px-2 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-80",
                          color.chip,
                          color.border,
                        )}
                      >
                        <span className={cn("block font-semibold", color.text)}>
                          {fmtTime(t.departure_at)}–{fmtTime(t.return_at)}
                        </span>
                        <span className="block truncate">{tripCity(t)}</span>
                        <span className="block truncate text-muted-foreground">
                          {tripDriverName(t)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unassigned.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 font-display text-base font-semibold">Sem veículo definido</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {unassigned.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setTripId(t.id)}
                  className="w-full rounded-lg border border-dashed border-border p-3 text-left text-sm hover:border-primary/50"
                >
                  <span className="font-medium">
                    {fmtTime(t.departure_at)} · {tripCity(t)}
                  </span>
                  <span className="block text-muted-foreground">{t.destination_text}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TripDrawer tripId={tripId} onClose={() => setTripId(null)} />
    </AppShell>
  );
}
