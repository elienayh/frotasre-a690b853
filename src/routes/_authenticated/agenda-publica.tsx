import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TripDrawer } from "@/components/TripDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [tripId, setTripId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"Mês" | "Semana" | "Dia" | "Lista">("Mês");

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

  const stats = useMemo(() => {
    return {
      total: filtered.length,
      aprovadas: filtered.filter(t => t.status === "APROVADA" || t.status === "PROGRAMADA").length,
      aguardando: filtered.filter(t => t.status === "PENDENTE").length,
      emAndamento: filtered.filter(t => t.status === "EM_ANDAMENTO").length,
    };
  }, [filtered]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (fCidade !== ALL) count++;
    if (fSetor !== ALL) count++;
    if (fVeiculo !== ALL) count++;
    if (fStatus !== ALL) count++;
    if (fDestino.trim()) count++;
    if (fMotorista.trim()) count++;
    return count;
  }, [fCidade, fSetor, fVeiculo, fStatus, fDestino, fMotorista]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaTrip[]>();
    for (const t of filtered) {
      const key = dayKey(t.departure_at);
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    for (const t of filtered) {
      const depKey = dayKey(t.departure_at);
      const retKey = dayKey(t.return_at);
      if (depKey !== retKey) {
        const d = new Date(t.departure_at);
        d.setDate(d.getDate() + 1);
        while (dayKey(d) <= retKey) {
           const key = dayKey(d);
           const list = map.get(key);
           if (list) {
             if (!list.find(x => x.id === t.id)) list.push(t);
           } else {
             map.set(key, [t]);
           }
           d.setDate(d.getDate() + 1);
        }
      }
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
      title="Cronograma"
      description="Agenda institucional da frota, por dia e por setor."
      fullWidth
      actions={
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-6 mr-6 bg-card/50 px-6 py-2 rounded-2xl border border-border/40">
            <Stat label="Total" value={stats.total} color="text-foreground" />
            <Stat label="Aprovadas" value={stats.aprovadas} color="text-emerald-500" />
            <Stat label="Aguardando" value={stats.aguardando} color="text-amber-500" />
            <Stat label="Em andamento" value={stats.emAndamento} color="text-blue-500" />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeFiltersCount > 0 ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "rounded-xl font-bold transition-all",
                activeFiltersCount > 0 && "shadow-lg shadow-primary/20"
              )}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-2 rounded-full bg-primary-foreground text-primary px-1.5 py-0.5 text-[10px] font-black">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl">
              {["Semana", "Dia", "Mês", "Lista"].map((m) => (
                <Button
                  key={m}
                  variant={viewMode === m ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode(m as any)}
                  className="rounded-lg text-xs font-bold"
                >
                  {m}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-1 ml-2">
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
          </div>
        </div>
      }
    >
      <div className={cn("grid gap-8 transition-all duration-300", showFilters ? "lg:grid-cols-[18rem_1fr]" : "grid-cols-1")}>
        {showFilters && (
          <aside className="space-y-6 animate-in slide-in-from-left duration-300">
          <Card className="p-6 border-none shadow-xl bg-card/60 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <p className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <Filter className="h-4 w-4 text-primary" /> Filtros
              </p>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs font-bold text-muted-foreground hover:text-primary">
                Limpar
              </Button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="f-destino" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Destino</Label>
                <Input
                  id="f-destino"
                  value={fDestino}
                  onChange={(e) => setFDestino(e.target.value)}
                  placeholder="Escola, órgão…"
                  className="rounded-xl border-border/40 bg-background/50"
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
                <Label htmlFor="f-motorista" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Motorista</Label>
                <Input
                  id="f-motorista"
                  value={fMotorista}
                  onChange={(e) => setFMotorista(e.target.value)}
                  placeholder="Nome do condutor"
                  className="rounded-xl border-border/40 bg-background/50"
                />
              </div>

              <div className="space-y-3 border-t border-border/40 pt-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  Legenda de Setores
                </p>
                <ul className="space-y-2">
                  {SECTORS.map((s) => (
                    <li key={s} className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                      <span className={cn("h-3 w-3 rounded-full shadow-sm", sectorColor(s).dot)} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </aside>
        )}

        <section className="min-w-0 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-black tracking-tight text-foreground">
                  {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
                </h2>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {isLoading ? "Sincronizando..." : `${filtered.length} solicitações encontradas`}
                </p>
              </div>
            </div>
          </div>

          <Card className="overflow-hidden border-none shadow-2xl bg-card/60 backdrop-blur-xl rounded-3xl">
            <div className="grid grid-cols-7 border-b border-border/40 bg-muted/30">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="px-2 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70"
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
                const isToday = key === todayKey;
                const expanded = expandedDay === key;
                const shown = expanded ? items : items.slice(0, 3);
                
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-[140px] border-b border-r border-border/40 p-2 last:border-r-0 transition-colors duration-200 group cursor-pointer",
                      outside ? "bg-muted/10 opacity-50" : "hover:bg-accent/20",
                    )}
                    onClick={() => {
                      const isoDate = d.toISOString().split('T')[0];
                      navigate({ to: "/solicitacoes/nova", search: { initialDate: isoDate } });
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black transition-all duration-300",
                          isToday
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110"
                            : outside
                              ? "text-muted-foreground/40"
                              : "text-foreground group-hover:text-primary",
                        )}
                      >
                        {d.getDate()}
                      </span>
                      {isToday && (
                        <span className="text-[8px] font-black uppercase tracking-tighter text-primary px-1.5 py-0.5 rounded-full bg-primary/10">Hoje</span>
                      )}
                    </div>
                    
                    <ul className="space-y-1.5">
                      {shown.map((t) => {
                        const color = sectorColor(t.requester?.sector);
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTripId(t.id);
                              }}
                              className={cn(
                                "w-full rounded-xl border px-2 py-2 text-left text-[10px] leading-tight transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-sm",
                                color.chip,
                                color.border,
                                "bg-opacity-90 backdrop-blur-sm"
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={cn("font-black tracking-tight", color.text)}>
                                  {fmtTime(t.departure_at)}
                                </span>
                                <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                              </div>
                              <span className={cn("block font-black text-[11px] uppercase tracking-tight", color.text)}>
                                {tripCity(t)}
                              </span>
                              <span className="block truncate opacity-80 font-medium text-[9px] mt-0.5 leading-tight">
                                {t.destination_text}
                              </span>

                            </button>
                          </li>
                        );
                      })}
                      {items.length > 3 ? (
                        <li>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDay(expanded ? null : key);
                            }}
                            className="w-full rounded-xl px-2 py-1.5 text-center text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors"
                          >
                            {expanded ? "ver menos" : `+${items.length - 3} itens`}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>
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
      <Label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="rounded-xl border-border/40 bg-background/50">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl">
          <SelectItem value={ALL} className="rounded-xl">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="rounded-xl">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

