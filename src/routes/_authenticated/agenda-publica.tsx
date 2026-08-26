import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { TripDrawer } from "@/components/TripDrawer";
import { DayTripsDialog } from "@/components/DayTripsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useAgendaTrips,
  tripCity,
  tripDriverName,
  tripDestinations,
  tripSeats,
  type AgendaTrip,
} from "@/hooks/useAgenda";
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

type ViewMode = "Mês" | "Semana" | "Dia" | "Lista";
const VIEW_MODES: ViewMode[] = ["Semana", "Dia", "Mês", "Lista"];

function dayKey(value: string | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(value: Date, amount: number): Date {
  const d = new Date(value);
  d.setDate(d.getDate() + amount);
  return d;
}

function startOfWeek(value: Date): Date {
  const d = startOfDay(value);
  return addDays(d, -d.getDay());
}

const LONG_DATE = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function CalendarioViagens() {
  const { isAdmin, isSuperAdmin, isCoordinator, profile } = useAuth();
  const today = new Date();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(startOfDay(today));
  const [tripId, setTripId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("Mês");

  const [fDestino, setFDestino] = useState("");
  const [fCidade, setFCidade] = useState(ALL);
  const [fSetor, setFSetor] = useState(ALL);
  const [fVeiculo, setFVeiculo] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fMotorista, setFMotorista] = useState("");

  const { data: cities = [] } = useCities();
  const { data: vehicles = [] } = useVehicles();

  // Somente usuários com perfil ativo podem iniciar uma solicitação.
  const canCreate = Boolean(profile);

  /** Intervalo carregado do banco: uma única fonte de dados para os quatro modos. */
  const range = useMemo(() => {
    if (viewMode === "Dia") {
      const start = startOfDay(cursor);
      return { start, end: addDays(start, 1) };
    }
    if (viewMode === "Semana") {
      const start = startOfWeek(cursor);
      return { start, end: addDays(start, 7) };
    }
    if (viewMode === "Lista") {
      const start = startOfDay(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
      const end = startOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
      return { start, end };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return { start, end: addDays(start, 42) };
  }, [cursor, viewMode]);

  const { data: trips = [], isLoading } = useAgendaTrips(
    range.start.toISOString(),
    range.end.toISOString(),
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
      aprovadas: filtered.filter((t) => t.status === "APROVADA" || t.status === "PROGRAMADA").length,
      aguardando: filtered.filter((t) => t.status === "PENDENTE").length,
      emAndamento: filtered.filter((t) => t.status === "EM_ANDAMENTO").length,
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

  /** Índice dia → viagens, considerando viagens que atravessam vários dias. */
  const byDay = useMemo(() => {
    const map = new Map<string, AgendaTrip[]>();
    const push = (key: string, trip: AgendaTrip) => {
      const list = map.get(key);
      if (!list) map.set(key, [trip]);
      else if (!list.some((x) => x.id === trip.id)) list.push(trip);
    };
    for (const t of filtered) {
      push(dayKey(t.departure_at), t);
      const retKey = dayKey(t.return_at);
      let d = addDays(new Date(t.departure_at), 1);
      while (dayKey(d) <= retKey) {
        push(dayKey(d), t);
        d = addDays(d, 1);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime());
    }
    return map;
  }, [filtered]);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const listTrips = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime(),
      ),
    [filtered],
  );

  const clearFilters = () => {
    setFDestino("");
    setFCidade(ALL);
    setFSetor(ALL);
    setFVeiculo(ALL);
    setFStatus(ALL);
    setFMotorista("");
  };

  const step = (direction: 1 | -1) => {
    if (viewMode === "Dia") setCursor(addDays(cursor, direction));
    else if (viewMode === "Semana") setCursor(addDays(cursor, direction * 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
  };

  const openDay = (d: Date) => setSelectedDay(startOfDay(d));

  const createTripForDate = (d: Date) => {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setSelectedDay(null);
    navigate({ to: "/solicitacoes/nova", search: { initialDate: iso } });
  };

  const todayKey = dayKey(today);

  /** Posicionamento automático na semana atual (apenas carga inicial ou "Hoje"). */
  const todayCellRef = useRef<HTMLDivElement | null>(null);
  const didInitialScroll = useRef(false);
  const [scrollToken, setScrollToken] = useState(0);

  useEffect(() => {
    if (viewMode !== "Mês") return;
    if (didInitialScroll.current && scrollToken === 0) return;
    if (isLoading) return;

    const raf = requestAnimationFrame(() => {
      const el = todayCellRef.current;
      if (!el) return;
      el.scrollIntoView({
        block: "center",
        behavior: didInitialScroll.current ? "smooth" : "auto",
      });
      didInitialScroll.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [viewMode, scrollToken, isLoading, trips.length]);


  const periodLabel =
    viewMode === "Dia"
      ? LONG_DATE.format(cursor)
      : viewMode === "Semana"
        ? `${startOfWeek(cursor).getDate()} – ${addDays(startOfWeek(cursor), 6).getDate()} de ${MONTHS[addDays(startOfWeek(cursor), 6).getMonth()]}`
        : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <AppShell
      title="Cronograma"
      description="Agenda institucional da frota, por dia e por setor."
      fullWidth
      actions={
        <div className="flex items-center gap-4">
          {(isAdmin || isSuperAdmin || isCoordinator) && (
            <div className="mr-6 hidden items-center gap-6 rounded-2xl border border-border/40 bg-card/50 px-6 py-2 md:flex">
              <Stat label="Total" value={stats.total} color="text-foreground" />
              <Stat label="Aprovadas" value={stats.aprovadas} color="text-emerald-500" />
              <Stat label="Aguardando" value={stats.aguardando} color="text-amber-500" />
              <Stat label="Em andamento" value={stats.emAndamento} color="text-blue-500" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant={activeFiltersCount > 0 ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "rounded-xl font-bold transition-all",
                activeFiltersCount > 0 && "shadow-lg shadow-primary/20",
              )}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-2 rounded-full bg-primary-foreground px-1.5 py-0.5 text-[10px] font-black text-primary">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            <div className="flex items-center gap-1 rounded-xl bg-muted/30 p-1">
              {VIEW_MODES.map((m) => (
                <Button
                  key={m}
                  variant={viewMode === m ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={viewMode === m}
                  onClick={() => setViewMode(m)}
                  className={cn(
                    "rounded-lg text-xs font-bold",
                    viewMode === m && "shadow-sm ring-1 ring-border/60",
                  )}
                >
                  {m}
                </Button>
              ))}
            </div>

            <div className="ml-2 flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => step(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" aria-label="Próximo período" onClick={() => step(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="flex items-center gap-4 font-display text-3xl font-black capitalize tracking-tight text-foreground md:text-4xl">
              {periodLabel}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {isLoading ? "Sincronizando dados..." : `${filtered.length} solicitações no período`}
              </p>
            </div>
          </div>
        </div>

        {(isAdmin || isSuperAdmin || isCoordinator) && (
          <div className="flex items-center gap-4 rounded-2xl border border-border/40 bg-card/50 px-4 py-2 md:hidden">
            <Stat label="Viagens" value={stats.total} color="text-foreground" />
            <Stat label="OK" value={stats.aprovadas} color="text-emerald-500" />
          </div>
        )}
      </div>

      <div
        className={cn(
          "grid gap-8 transition-all duration-300",
          showFilters ? "lg:grid-cols-[18rem_1fr]" : "grid-cols-1",
        )}
      >
        {showFilters && (
          <aside className="animate-in slide-in-from-left space-y-6 duration-300">
            <Card className="border-none bg-card/60 p-6 shadow-xl backdrop-blur-xl">
              <div className="mb-6 flex items-center justify-between">
                <p className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                  <Filter className="h-4 w-4 text-primary" /> Filtros
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs font-bold text-muted-foreground hover:text-primary"
                >
                  Limpar
                </Button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="f-destino"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70"
                  >
                    Destino
                  </Label>
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
                  <Label
                    htmlFor="f-motorista"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70"
                  >
                    Motorista
                  </Label>
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
                      <li
                        key={s}
                        className="flex items-center gap-3 text-sm font-medium text-foreground/80"
                      >
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
          {viewMode === "Mês" && (
            <Card className="overflow-hidden rounded-3xl border-none bg-card/60 shadow-2xl backdrop-blur-xl">
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
                {monthDays.map((d) => {
                  const key = dayKey(d);
                  const items = byDay.get(key) ?? [];
                  const outside = d.getMonth() !== cursor.getMonth();
                  const isToday = key === todayKey;
                  const shown = items.slice(0, 3);

                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDay(d)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDay(d);
                        }
                      }}
                      className={cn(
                        "group min-h-[180px] cursor-pointer border-b border-r border-border/40 p-3 transition-colors duration-200 last:border-r-0",
                        outside ? "bg-muted/10 opacity-50" : "hover:bg-accent/20",
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span
                          className={cn(
                            "relative inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition-all duration-300",
                            isToday
                              ? "scale-110 bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                              : outside
                                ? "text-muted-foreground/40"
                                : "text-foreground group-hover:text-primary",
                          )}
                        >
                          {d.getDate()}
                        </span>
                        {isToday && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter text-primary">
                            Hoje
                          </span>
                        )}
                      </div>

                      <ul className="space-y-2">
                        {shown.map((t) => (
                          <li key={t.id}>
                            <TripChip trip={t} onOpen={() => setTripId(t.id)} maxDestinations={5} />
                          </li>
                        ))}
                        {items.length > 3 ? (
                          <li>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDay(d);
                              }}
                              className="w-full rounded-xl px-2 py-2 text-center text-[10px] font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
                            >
                              + {items.length - 3} viagens
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {viewMode === "Semana" && (
            <Card className="overflow-hidden rounded-3xl border-none bg-card/60 shadow-2xl backdrop-blur-xl">
              <div className="grid grid-cols-1 sm:grid-cols-7">
                {weekDays.map((d) => {
                  const key = dayKey(d);
                  const items = byDay.get(key) ?? [];
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDay(d)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDay(d);
                        }
                      }}
                      className="min-h-[220px] cursor-pointer border-b border-r border-border/40 p-3 transition-colors last:border-r-0 hover:bg-accent/20"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-black",
                            isToday
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground",
                          )}
                        >
                          {d.getDate()}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                          {WEEKDAYS[d.getDay()]}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {items.map((t) => (
                          <li key={t.id}>
                            <TripChip trip={t} onOpen={() => setTripId(t.id)} maxDestinations={5} />
                          </li>
                        ))}
                        {items.length === 0 ? (
                          <li className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                            Livre
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {viewMode === "Dia" && (
            <Card className="rounded-3xl border-none bg-card/60 p-6 shadow-2xl backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between">
                <p className="font-display text-lg font-black capitalize text-foreground">
                  {LONG_DATE.format(cursor)}
                </p>
                {canCreate && (
                  <Button size="sm" className="rounded-xl font-bold" onClick={() => createTripForDate(cursor)}>
                    + Nova viagem
                  </Button>
                )}
              </div>
              <ul className="space-y-3">
                {(byDay.get(dayKey(cursor)) ?? []).map((t) => (
                  <li key={t.id}>
                    <TripRow trip={t} onOpen={() => setTripId(t.id)} />
                  </li>
                ))}
                {(byDay.get(dayKey(cursor)) ?? []).length === 0 && (
                  <li className="py-12 text-center text-sm font-medium text-muted-foreground">
                    Nenhuma viagem programada para este dia.
                  </li>
                )}
              </ul>
            </Card>
          )}

          {viewMode === "Lista" && (
            <Card className="rounded-3xl border-none bg-card/60 p-6 shadow-2xl backdrop-blur-xl">
              <ul className="space-y-3">
                {listTrips.map((t) => (
                  <li key={t.id}>
                    <TripRow trip={t} onOpen={() => setTripId(t.id)} showDate />
                  </li>
                ))}
                {listTrips.length === 0 && (
                  <li className="py-12 text-center text-sm font-medium text-muted-foreground">
                    Nenhuma viagem no período selecionado.
                  </li>
                )}
              </ul>
            </Card>
          )}
        </section>
      </div>

      <DayTripsDialog
        date={selectedDay}
        trips={selectedDay ? (byDay.get(dayKey(selectedDay)) ?? []) : []}
        canCreate={canCreate}
        onClose={() => setSelectedDay(null)}
        onSelectTrip={(id) => {
          setSelectedDay(null);
          setTripId(id);
        }}
        onCreateTrip={createTripForDate}
      />

      <TripDrawer tripId={tripId} onClose={() => setTripId(null)} />
    </AppShell>
  );
}

/** Card compacto de viagem usado nas visões Mês e Semana. */
function TripChip({
  trip,
  onOpen,
  maxDestinations = 3,
}: {
  trip: AgendaTrip;
  onOpen: () => void;
  /** Limite de destinos exibidos; o excedente vira "+ X destinos". */
  maxDestinations?: number;
}) {
  const color = sectorColor(trip.requester?.sector);
  const destinations = tripDestinations(trip);
  const shown = destinations.slice(0, maxDestinations);
  const extra = destinations.length - shown.length;
  const seats = tripSeats(trip);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "w-full rounded-xl border border-l-4 px-2.5 py-2.5 text-left shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-95",
        color.chip,
        color.border,
        "bg-opacity-95 backdrop-blur-sm",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn("text-[10px] font-black uppercase tracking-widest", color.text)}>
          {fmtTime(trip.departure_at)}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase tracking-tight text-muted-foreground">
          <Users className="h-3 w-3" aria-hidden />
          {seats.label}
        </span>
      </div>
      <span
        className={cn(
          "mb-1 block truncate text-xs font-black uppercase leading-none tracking-tight",
          color.text,
        )}
      >
        {tripCity(trip)}
      </span>
      <ul className="space-y-0.5">
        {shown.map((d, i) => (
          <li
            key={`${d}-${i}`}
            className="flex items-start gap-1 text-[10px] font-semibold leading-tight opacity-70"
          >
            <span aria-hidden>•</span>
            <span className="truncate">{d}</span>
          </li>
        ))}
        {extra > 0 ? (
          <li className="text-[10px] font-bold leading-tight opacity-60">
            + {extra} {extra === 1 ? "destino" : "destinos"}
          </li>
        ) : null}
      </ul>
    </button>
  );
}

/** Linha detalhada de viagem usada nas visões Dia e Lista. */
function TripRow({
  trip,
  onOpen,
  showDate = false,
}: {
  trip: AgendaTrip;
  onOpen: () => void;
  showDate?: boolean;
}) {
  const color = sectorColor(trip.requester?.sector);
  const date = new Date(trip.departure_at);
  const destinations = tripDestinations(trip);
  const seats = tripSeats(trip);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-4 rounded-2xl border border-l-4 bg-background/40 px-4 py-3 text-left transition-colors hover:bg-accent/40",
        color.border,
      )}
    >
      <span className="shrink-0 text-left">
        {showDate && (
          <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
            {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        )}
        <span className={cn("block text-sm font-black tabular-nums", color.text)}>
          {fmtTime(trip.departure_at)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black uppercase tracking-tight text-foreground">
          {tripCity(trip)}
        </span>
        <span className="mt-0.5 block space-y-0.5 text-xs font-medium text-muted-foreground">
          {destinations.map((d, i) => (
            <span key={`${d}-${i}`} className="block truncate">
              • {d}
            </span>
          ))}
        </span>
        <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          {tripDriverName(trip)} · {trip.requester?.sector ?? "—"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
          {TRIP_STATUS_LABEL[trip.status] ?? trip.status}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
          <Users className="h-3 w-3" aria-hidden />
          {seats.label}
        </span>
      </span>
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex min-w-[70px] flex-col items-center">
      <span className={cn("text-xl font-black leading-none tracking-tighter", color)}>{value}</span>
      <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
    </div>
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
      <Label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="rounded-xl border-border/40 bg-background/50">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl">
          <SelectItem value={ALL} className="rounded-xl">
            Todos
          </SelectItem>
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
