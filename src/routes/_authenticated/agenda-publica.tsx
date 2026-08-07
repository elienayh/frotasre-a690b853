import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TripDrawer } from "@/components/TripDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgendaTrips, tripCity, tripDriverName, type AgendaTrip } from "@/hooks/useAgenda";
import { useCities } from "@/hooks/useFrotaOptions";
import { useVehicles } from "@/hooks/useFleet";
import { SECTORS, sectorColor } from "@/lib/setores";
import { TRIP_STATUS_LABEL, fmtTime } from "@/lib/frota";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda-publica")({
  component: CalendarioViagens,
});

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const STATUSES = ["PENDENTE", "APROVADA", "PROGRAMADA", "EM_ANDAMENTO", "CONCLUIDA"];
const ALL = "__all__";

function dayKey(value: string | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarioViagens() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [tripId, setTripId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const [fDestino, setFDestino] = useState("");
  const [fCidade, setFCidade] = useState(ALL);
  const [fSetor, setFSetor] = useState(ALL);
  const [fVeiculo, setFVeiculo] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fMotorista, setFMotorista] = useState("");

  const { data: cities = [] } = useCities();
  const { data: vehicles = [] } = useVehicles();

  const gridStart = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }, [cursor]);

  const gridEnd = useMemo(() => {
    const end = new Date(gridStart);
    end.setDate(gridStart.getDate() + 42);
    return end;
  }, [gridStart]);

  const { data: trips = [], isLoading } = useAgendaTrips(
    gridStart.toISOString(),
    gridEnd.toISOString(),
  );

  const filtered = useMemo(
    () =>
      trips.filter((t) => {
        if (fCidade !== ALL && t.city_id !== fCidade) return false;
        if (fSetor !== ALL && (t.requester?.sector ?? "") !== fSetor) return false;
        if (fVeiculo !== ALL && t.vehicle_id !== fVeiculo) return false;
        if (fStatus !== ALL && t.status !== fStatus) return false;
        if (fDestino.trim()) {
          const needle = fDestino.trim().toLowerCase();
          const haystack = `${t.destination_text} ${tripCity(t)}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        if (fMotorista.trim()) {
          if (!tripDriverName(t).toLowerCase().includes(fMotorista.trim().toLowerCase()))
            return false;
        }
        return true;
      }),
    [trips, fCidade, fSetor, fVeiculo, fStatus, fDestino, fMotorista],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaTrip[]>();
    for (const t of filtered) {
      const key = dayKey(t.departure_at);
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    return map;
  }, [filtered]);

  const days = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
      }),
    [gridStart],
  );

  const clearFilters = () => {
    setFDestino("");
    setFCidade(ALL);
    setFSetor(ALL);
    setFVeiculo(ALL);
    setFStatus(ALL);
    setFMotorista("");
  };

  const todayKey = dayKey(today);

  return (
    <AppShell
      title="Calendário de Viagens"
      description="Agenda institucional da frota, por dia e por setor."
      actions={
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mês anterior"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo mês"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-display text-sm font-semibold">
              <Filter className="h-4 w-4" /> Filtros
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="f-destino">Destino</Label>
            <Input
              id="f-destino"
              value={fDestino}
              onChange={(e) => setFDestino(e.target.value)}
              placeholder="Escola, órgão…"
            />
          </div>

          <FilterSelect
            id="f-cidade"
            label="Cidade"
            value={fCidade}
            onChange={setFCidade}
            options={cities.map((c) => ({ value: c.id, label: c.name }))}
          />
          <FilterSelect
            id="f-setor"
            label="Setor"
            value={fSetor}
            onChange={setFSetor}
            options={SECTORS.map((s) => ({ value: s, label: s }))}
          />
          <FilterSelect
            id="f-veiculo"
            label="Veículo"
            value={fVeiculo}
            onChange={setFVeiculo}
            options={vehicles.map((v) => ({
              value: v.id,
              label: `${v.manufacturer} ${v.model} — ${v.plate}`,
            }))}
          />
          <FilterSelect
            id="f-status"
            label="Status"
            value={fStatus}
            onChange={setFStatus}
            options={STATUSES.map((s) => ({ value: s, label: TRIP_STATUS_LABEL[s] ?? s }))}
          />

          <div className="space-y-2">
            <Label htmlFor="f-motorista">Motorista</Label>
            <Input
              id="f-motorista"
              value={fMotorista}
              onChange={(e) => setFMotorista(e.target.value)}
              placeholder="Nome do condutor"
            />
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cores por setor
            </p>
            <ul className="space-y-1">
              {SECTORS.map((s) => (
                <li key={s} className="flex items-center gap-2 text-sm">
                  <span className={cn("h-2.5 w-2.5 rounded-full", sectorColor(s).dot)} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </h2>
            <span className="text-sm text-muted-foreground">
              {isLoading ? "carregando…" : `${filtered.length} viagem(ns)`}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-7 border-b border-border bg-muted/50">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = dayKey(d);
                const items = byDay.get(key) ?? [];
                const outside = d.getMonth() !== cursor.getMonth();
                const expanded = expandedDay === key;
                const shown = expanded ? items : items.slice(0, 3);
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-28 border-b border-r border-border p-1.5 last:border-r-0",
                      outside && "bg-muted/30",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          key === todayKey
                            ? "bg-primary text-primary-foreground"
                            : outside
                              ? "text-muted-foreground/60"
                              : "text-foreground",
                        )}
                      >
                        {d.getDate()}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {shown.map((t) => {
                        const color = sectorColor(t.requester?.sector);
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => setTripId(t.id)}
                              className={cn(
                                "w-full rounded border-l-2 px-1.5 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-80",
                                color.chip,
                                color.border,
                              )}
                            >
                              <span className={cn("block font-semibold", color.text)}>
                                {fmtTime(t.departure_at)} {tripCity(t)}
                              </span>
                              <span className="block truncate text-muted-foreground">
                                {t.vehicles
                                  ? `${t.vehicles.manufacturer} ${t.vehicles.model}`
                                  : "Veículo a definir"}
                              </span>
                              <span className="block truncate text-muted-foreground">
                                {tripDriverName(t)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {items.length > 3 ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => setExpandedDay(expanded ? null : key)}
                            className="w-full rounded px-1.5 py-0.5 text-left text-[11px] font-semibold text-primary hover:underline"
                          >
                            {expanded ? "mostrar menos" : `+${items.length - 3} viagens`}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <TripDrawer tripId={tripId} onClose={() => setTripId(null)} />
    </AppShell>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
