import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  LayoutGrid, 
  LayoutList, 
  Calendar as CalendarIcon,
  Columns,
  Search,
  Plus
} from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/AppShell";
import { TripDrawer } from "@/components/TripDrawer";
import { TripCard } from "@/components/TripCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { TRIP_STATUS_LABEL, fmtTime, statusTone } from "@/lib/frota";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";


export const Route = createFileRoute("/_authenticated/agenda-publica")({
  component: CalendarioViagens,
});

const STATUSES = ["PENDENTE", "APROVADA", "PROGRAMADA", "EM_ANDAMENTO", "CONCLUIDA"];
const ALL = "__all__";

type ViewMode = "week" | "day" | "month" | "list";

function CalendarioViagens() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(new Date());
  const [tripId, setTripId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [fDestino, setFDestino] = useState("");
  const [fCidade, setFCidade] = useState(ALL);
  const [fSetor, setFSetor] = useState(ALL);
  const [fVeiculo, setFVeiculo] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fMotorista, setFMotorista] = useState("");

  const { data: cities = [] } = useCities();
  const { data: vehicles = [] } = useVehicles();

  const { start, end } = useMemo(() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(cursor);
      const start = startOfWeek(monthStart, { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
      return { start, end };
    }
    if (viewMode === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      const end = endOfWeek(cursor, { weekStartsOn: 0 });
      return { start, end };
    }
    if (viewMode === "day") {
      const start = new Date(cursor);
      start.setHours(0, 0, 0, 0);
      const end = new Date(cursor);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    // List view: fetch current month by default or a wider range
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    return { start, end };
  }, [cursor, viewMode]);

  const { data: trips = [], isLoading } = useAgendaTrips(
    start.toISOString(),
    end.toISOString()
  );

  const filtered = useMemo(() => {
    return trips.filter((t) => {
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
    });
  }, [trips, fCidade, fSetor, fVeiculo, fStatus, fDestino, fMotorista]);

  const stats = useMemo(() => {
    return {
      total: filtered.length,
      approved: filtered.filter(t => t.status === "APROVADA" || t.status === "PROGRAMADA").length,
      pending: filtered.filter(t => t.status === "PENDENTE").length,
      ongoing: filtered.filter(t => t.status === "EM_ANDAMENTO").length,
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

  const navigatePeriod = (direction: "next" | "prev") => {
    if (viewMode === "month") {
      setCursor(direction === "next" ? addMonths(cursor, 1) : subMonths(cursor, 1));
    } else if (viewMode === "week") {
      setCursor(direction === "next" ? addWeeks(cursor, 1) : subWeeks(cursor, 1));
    } else if (viewMode === "day") {
      setCursor(direction === "next" ? addDays(cursor, 1) : subDays(cursor, 1));
    }
  };

  const clearFilters = () => {
    setFDestino("");
    setFCidade(ALL);
    setFSetor(ALL);
    setFVeiculo(ALL);
    setFStatus(ALL);
    setFMotorista("");
  };

  return (
    <AppShell
      title="Cronograma"
      description="Agenda operacional da frota."
      actions={
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="hidden md:block">
            <TabsList className="bg-muted/50 p-1 rounded-xl h-9 border border-border/40">
              <TabsTrigger value="day" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-7">Dia</TabsTrigger>
              <TabsTrigger value="week" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-7">Semana</TabsTrigger>
              <TabsTrigger value="month" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-7">Mês</TabsTrigger>
              <TabsTrigger value="list" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-7">Lista</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/40">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => navigatePeriod("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="h-7 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg" onClick={() => setCursor(new Date())}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => navigatePeriod("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant={activeFiltersCount > 0 ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "rounded-xl font-bold h-9",
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
        </div>
      }
    >
      <div className={cn("grid gap-6 transition-all duration-300", showFilters ? "lg:grid-cols-[18rem_1fr]" : "grid-cols-1")}>
        {showFilters && (
          <aside className="space-y-6 animate-in slide-in-from-left duration-300">
            <Card className="p-6 border-none shadow-xl bg-card/60 backdrop-blur-xl rounded-3xl">
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
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Destino</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                      value={fDestino}
                      onChange={(e) => setFDestino(e.target.value)}
                      placeholder="Pesquisar escola..."
                      className="rounded-xl pl-9 border-border/40 bg-background/50 h-10 text-sm"
                    />
                  </div>
                </div>

                <FilterSelect label="Cidade" value={fCidade} onChange={setFCidade} options={cities.map((c) => ({ value: c.id, label: c.name }))} />
                <FilterSelect label="Setor" value={fSetor} onChange={setFSetor} options={SECTORS.map((s) => ({ value: s, label: s }))} />
                <FilterSelect label="Status" value={fStatus} onChange={setFStatus} options={STATUSES.map((s) => ({ value: s, label: TRIP_STATUS_LABEL[s] ?? s }))} />

                <div className="pt-4 border-t border-border/40 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                    Resumo do Período
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <StatItem label="Viagens" value={stats.total} color="bg-primary/10 text-primary" />
                    <StatItem label="Aprovadas" value={stats.approved} color="bg-success/10 text-success" />
                    <StatItem label="Pendentes" value={stats.pending} color="bg-warning/10 text-warning" />
                    <StatItem label="Em curso" value={stats.ongoing} color="bg-info/10 text-info" />
                  </div>
                </div>
              </div>
            </Card>
          </aside>
        )}

        <section className="min-w-0 space-y-6">
          <header className="flex flex-col gap-1">
            <h2 className="font-display text-3xl font-black tracking-tighter text-foreground uppercase">
              {viewMode === "day" 
                ? format(cursor, "d 'de' MMMM", { locale: ptBR })
                : format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-black tracking-widest px-2 py-0.5 border-primary/20 text-primary uppercase">
                {viewMode === "week" ? "Visão Semanal" : viewMode === "month" ? "Visão Mensal" : viewMode === "day" ? "Visão Diária" : "Visão Lista"}
              </Badge>
              {isLoading && (
                <span className="text-[10px] font-bold text-muted-foreground animate-pulse">Sincronizando dados...</span>
              )}
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode + cursor.toISOString()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {viewMode === "week" && <WeekTimeline cursor={cursor} trips={filtered} onTripClick={setTripId} />}
              {viewMode === "day" && <DayTimeline cursor={cursor} trips={filtered} onTripClick={setTripId} />}
              {viewMode === "month" && <MonthTimeline cursor={cursor} trips={filtered} onTripClick={setTripId} onDayClick={(d) => { setCursor(d); setViewMode("day"); }} />}
              {viewMode === "list" && <ListTimeline trips={filtered} onTripClick={setTripId} />}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>

      <TripDrawer tripId={tripId} onClose={() => setTripId(null)} />
    </AppShell>
  );
}

function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn("rounded-xl p-2 text-center border border-border/20", color)}>
      <p className="text-[18px] font-black leading-none mb-1">{value}</p>
      <p className="text-[8px] font-black uppercase tracking-widest opacity-80">{label}</p>
    </div>
  );
}

function WeekTimeline({ cursor, trips, onTripClick }: { cursor: Date; trips: AgendaTrip[]; onTripClick: (id: string) => void }) {
  const start = startOfWeek(cursor, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
      {weekDays.map((day) => {
        const dayTrips = trips.filter(t => isSameDay(new Date(t.departure_at), day));
        const active = isToday(day);

        return (
          <div key={day.toISOString()} className="space-y-4">
            <div className={cn(
              "p-3 rounded-2xl border flex flex-col items-center transition-all",
              active ? "bg-primary border-primary shadow-lg shadow-primary/20" : "bg-card border-border/40"
            )}>
              <span className={cn("text-[10px] font-black uppercase tracking-widest", active ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {format(day, "eee", { locale: ptBR })}
              </span>
              <span className={cn("text-2xl font-black tracking-tighter", active ? "text-primary-foreground" : "text-foreground")}>
                {format(day, "dd")}
              </span>
              <Badge variant="outline" className={cn("mt-1 text-[9px] font-black border-none px-2", active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {dayTrips.length} {dayTrips.length === 1 ? 'VIAGEM' : 'VIAGENS'}
              </Badge>
            </div>

            <div className="space-y-3 min-h-[200px]">
              {dayTrips.length > 0 ? (
                dayTrips.sort((a,b) => a.departure_at.localeCompare(b.departure_at)).map(t => (
                  <TripCard key={t.id} trip={t} onClick={onTripClick} />
                ))
              ) : (
                <button
                  onClick={() => navigate({ to: "/solicitacoes/nova", search: { initialDate: format(day, "yyyy-MM-dd") } })}
                  className="w-full h-24 border-2 border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all group"
                >
                  <Plus className="h-5 w-5 opacity-40 group-hover:opacity-100" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Nova Solicitação</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayTimeline({ cursor, trips, onTripClick }: { cursor: Date; trips: AgendaTrip[]; onTripClick: (id: string) => void }) {
  const dayTrips = trips.filter(t => isSameDay(new Date(t.departure_at), cursor)).sort((a,b) => a.departure_at.localeCompare(b.departure_at));

  return (
    <div className="bg-card/40 backdrop-blur-xl rounded-3xl border border-border/40 p-6">
      {dayTrips.length > 0 ? (
        <div className="space-y-6 relative before:absolute before:left-24 before:top-0 before:bottom-0 before:w-px before:bg-border/40">
          {dayTrips.map((t) => (
            <div key={t.id} className="flex gap-8 group">
              <div className="w-20 text-right shrink-0 pt-4">
                <span className="text-sm font-black text-primary tracking-tighter">{fmtTime(t.departure_at)}</span>
                <span className="block text-[9px] font-bold text-muted-foreground uppercase opacity-60">Partida</span>
              </div>
              <div className="flex-1 relative">
                <div className="absolute -left-[36.5px] top-5 w-2 h-2 rounded-full bg-primary ring-4 ring-card z-10" />
                <TripCard trip={t} onClick={onTripClick} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <CalendarDays className="h-12 w-12 opacity-10" />
          <p className="text-sm font-bold">Nenhuma viagem programada para este dia.</p>
        </div>
      )}
    </div>
  );
}

function MonthTimeline({ cursor, trips, onTripClick, onDayClick }: { cursor: Date; trips: AgendaTrip[]; onTripClick: (id: string) => void; onDayClick: (d: Date) => void }) {
  const monthStart = startOfMonth(cursor);
  const start = startOfWeek(monthStart, { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  return (
    <Card className="overflow-hidden border-none shadow-2xl bg-card/60 backdrop-blur-xl rounded-3xl">
      <div className="grid grid-cols-7 border-b border-border/40 bg-muted/30">
        {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((w) => (
          <div key={w} className="px-2 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dayTrips = trips.filter(t => isSameDay(new Date(t.departure_at), d));
          const outside = !isSameMonth(d, monthStart);
          const active = isToday(d);
          const shown = dayTrips.slice(0, 3);
          const remaining = dayTrips.length - 3;

          return (
            <div
              key={d.toISOString()}
              className={cn(
                "min-h-[140px] border-b border-r border-border/40 p-2 last:border-r-0 transition-all cursor-pointer hover:bg-accent/20",
                outside ? "bg-muted/10 opacity-40" : "bg-transparent"
              )}
              onClick={() => onDayClick(d)}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black",
                  active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110" : "text-foreground"
                )}>
                  {format(d, "dd")}
                </span>
                {dayTrips.length > 0 && (
                  <span className="text-[9px] font-black text-muted-foreground opacity-50">{dayTrips.length}V</span>
                )}
              </div>
              <div className="space-y-1">
                {shown.map(t => (
                  <TripCard key={t.id} trip={t} onClick={onTripClick} compact />
                ))}
                {remaining > 0 && (
                  <div className="text-center py-1 text-[9px] font-black uppercase text-primary tracking-widest">
                    +{remaining} viagens
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ListTimeline({ trips, onTripClick }: { trips: AgendaTrip[]; onTripClick: (id: string) => void }) {
  return (
    <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Horário</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Destino</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Solicitante</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Veículo</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Motorista</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.length > 0 ? (
            trips.map((t) => (
              <TableRow 
                key={t.id} 
                className="border-border/40 cursor-pointer hover:bg-accent/20 group transition-colors"
                onClick={() => onTripClick(t.id)}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-foreground">{fmtTime(t.departure_at)}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">{format(new Date(t.departure_at), "dd/MM")}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-primary uppercase tracking-tight">{tripCity(t)}</span>
                    <span className="text-[11px] font-medium text-muted-foreground line-clamp-1">{t.destination_text}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">{t.requester?.full_name || "—"}</span>
                    <span className="text-[10px] font-black text-muted-foreground uppercase">{t.requester?.sector || "—"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-bold text-foreground">
                    {t.vehicles ? `${t.vehicles.manufacturer} ${t.vehicles.model} (${t.vehicles.plate})` : "A definir"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-bold text-foreground">{tripDriverName(t)}</span>
                </TableCell>
                <TableCell>
                  <div className={cn(
                    "inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                    statusTone(t.status)
                  )}>
                    {TRIP_STATUS_LABEL[t.status] || t.status}
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-bold">
                Nenhuma viagem encontrada para o período.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-xl border-border/40 bg-background/50 h-10 text-sm">
          <SelectValue placeholder={`Selecionar ${label.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-border/40 shadow-2xl backdrop-blur-3xl">
          <SelectItem value={ALL} className="text-xs font-bold">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs font-medium">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}


