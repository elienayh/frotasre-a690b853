import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Filter, CheckCircle2, AlertCircle, Info } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { AllocateDialog } from "@/components/AllocateDialog";
import { RideDecisionDialog, type RideRow } from "@/components/RideDecisionDialog";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fmtDate, fmtTime, friendlyDbError, type TripRow } from "@/lib/frota";
import { cn } from "@/lib/utils";

type FilterType = "pendentes" | "programadas" | "aprovadas" | "carona" | "encerradas";

export const Route = createFileRoute("/_authenticated/admin/solicitacoes")({
  component: AdminSolicitacoes,
});

type Decision = { trip: TripRow; kind: "REJEITADA" | "CORRECAO" } | null;

function AdminSolicitacoes() {
  const queryClient = useQueryClient();
  const searchParams = Route.useSearch() as { tab?: string; filter?: string };
  
  const [activeFilter, setActiveFilter] = useState<FilterType>((searchParams?.filter as FilterType) || "pendentes");
  const [searchTerm, setSearchTerm] = useState("");
  const [allocating, setAllocating] = useState<TripRow | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [rideToDecide, setRideToDecide] = useState<RideRow | null>(null);

  // Sync with search params
  useEffect(() => {
    if (searchParams?.filter) {
      setActiveFilter(searchParams.filter as FilterType);
    } else if (searchParams?.tab) {
      // Compatibility with old tab param
      const tabToFilter: Record<string, FilterType> = {
        pendentes: "pendentes",
        programadas: "programadas",
        encerradas: "encerradas",
        caronas: "carona"
      };
      setActiveFilter(tabToFilter[searchParams.tab] || "pendentes");
    }
  }, [searchParams?.filter, searchParams?.tab]);

  // Fetch Trips
  const { data: trips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ["admin-trips-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select("*")
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return data as TripRow[];
    },
  });

  // Fetch Ride Requests
  const { data: rides = [], isLoading: loadingRides } = useQuery({
    queryKey: ["admin-ride-requests-all"],
    queryFn: async (): Promise<RideRow[]> => {
      const { data, error } = await supabase
        .from("ride_requests")
        .select(
          `id, seats, reason, status, created_at, requester_id,
           requester:profiles!ride_requests_requester_id_fkey(full_name, sector),
           trip:trip_requests!ride_requests_trip_id_fkey(id, code, destination_text, departure_at, return_at)`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RideRow[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id,
      kind,
      reason,
    }: {
      id: string;
      kind: "REJEITADA" | "CORRECAO";
      reason: string;
    }) => {
      const { error } = await supabase
        .from("trip_requests")
        .update({ status: kind, rejection_reason: reason })
        .eq("id", id);
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada.");
      setDecision(null);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filter Logic
  const filteredData = useMemo(() => {
    let combined: (TripRow | RideRow)[] = [];

    const tripStatusMap: Record<FilterType, string[]> = {
      pendentes: ["PENDENTE", "CORRECAO"],
      programadas: ["PROGRAMADA", "EM_ANDAMENTO"],
      aprovadas: ["APROVADA"],
      carona: ["PENDENTE", "APROVADA", "REJEITADA"], // Specific case for carona filter
      encerradas: ["CONCLUIDA", "REJEITADA", "CANCELADA"]
    };

    if (activeFilter === "carona") {
      combined = rides;
    } else if (activeFilter === "pendentes") {
      // Pendentes combines trips AND rides that are pending
      const pTrips = trips.filter(t => tripStatusMap.pendentes.includes(t.status || ""));
      const pRides = rides.filter(r => r.status === "PENDENTE");
      combined = [...pTrips, ...pRides].sort((a, b) => {
        const dateA = ("departure_at" in a ? a.departure_at : (a as RideRow).trip?.departure_at) || 0;
        const dateB = ("departure_at" in b ? b.departure_at : (b as RideRow).trip?.departure_at) || 0;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });


    } else {
      combined = trips.filter(t => tripStatusMap[activeFilter].includes(t.status || ""));
    }

    // Apply search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      combined = combined.filter((item) => {
        if ("destination_text" in item) {
          const trip = item as TripRow;
          return (
            trip.code?.toString().includes(term) ||
            trip.destination_text?.toLowerCase().includes(term) ||
            trip.requester_name?.toLowerCase().includes(term) ||
            trip.purpose?.toLowerCase().includes(term)
          );
        } else {
          const ride = item as RideRow;
          return (
            ride.trip?.code?.toString().includes(term) ||
            ride.trip?.destination_text?.toLowerCase().includes(term) ||
            ride.requester?.full_name?.toLowerCase().includes(term) ||
            ride.reason?.toLowerCase().includes(term)
          );
        }
      });
    }

    return combined;
  }, [activeFilter, trips, rides, searchTerm]);


  // Counts for chips
  const counts = useMemo(() => {
    return {
      pendentes: trips.filter(t => ["PENDENTE", "CORRECAO"].includes(t.status || "")).length + rides.filter(r => r.status === "PENDENTE").length,
      programadas: trips.filter(t => ["PROGRAMADA", "EM_ANDAMENTO"].includes(t.status || "")).length,
      aprovadas: trips.filter(t => t.status === "APROVADA").length,
      carona: rides.length,
      encerradas: trips.filter(t => ["CONCLUIDA", "REJEITADA", "CANCELADA"].includes(t.status || "")).length
    };
  }, [trips, rides]);

  const pendingSummary = useMemo(() => {
    const tCount = trips.filter(t => ["PENDENTE", "CORRECAO"].includes(t.status || "")).length;
    const rCount = rides.filter(r => r.status === "PENDENTE").length;
    return { trips: tCount, rides: rCount, total: tCount + rCount };
  }, [trips, rides]);

  const isLoading = loadingTrips || loadingRides;

  return (
    <AppShell
      title="Aprovações"
      description="Central de análise de solicitações de viagem e pedidos de carona."
    >
      <div className="flex flex-col gap-6">
        {/* Resumo no topo */}
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {pendingSummary.total > 0 
              ? `Você possui ${pendingSummary.total} ${pendingSummary.total === 1 ? 'item' : 'itens'} aguardando análise.`
              : "Tudo em dia!"}
          </h2>
          {pendingSummary.total > 0 && (
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-success/5 text-success border-success/20">
                {pendingSummary.trips} {pendingSummary.trips === 1 ? 'viagem' : 'viagens'}
              </Badge>
              <Badge variant="outline" className="bg-warning/5 text-warning border-warning/20">
                {pendingSummary.rides} {pendingSummary.rides === 1 ? 'carona' : 'caronas'}
              </Badge>
            </div>
          )}
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(["pendentes", "programadas", "aprovadas", "carona", "encerradas"] as FilterType[]).map((f) => (
              <Button
                key={f}
                variant={activeFilter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(f)}
                className="rounded-full px-4"
              >
                <span className="capitalize">{f}</span>
                {counts[f] > 0 && (
                  <span className={cn(
                    "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    activeFilter === f ? "bg-primary-foreground text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {counts[f]}
                  </span>
                )}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cidade, solicitante, destino ou número..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium leading-none">Filtros Complementares</h4>
                  <p className="text-sm text-muted-foreground">Em breve: filtros por período, setor e condutor.</p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Lista de Resultados */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-sm">Carregando dados...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-medium">Nenhuma pendência no momento.</h3>
            <p className="mt-1 text-sm text-muted-foreground">Tudo em dia! Nenhuma solicitação aguardando análise para este filtro.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredData.map((item) => {
              if ('destination_text' in item) {
                // Render Trip Card
                return (
                  <div
                    key={item.id}
                    onClick={() => setAllocating(item)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:border-success/50 hover:shadow-md"
                  >
                    <div className="absolute left-0 top-0 h-full w-1 bg-success" />
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-success">
                            <Info className="h-3 w-3" /> VIAGEM
                          </span>
                          <h3 className="mt-1 font-display text-base font-bold leading-tight group-hover:text-primary">
                            #{item.code} · {item.destination_text}
                          </h3>
                        </div>
                        <StatusBadge status={item.status || "PENDENTE"} />
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">Saída</span>
                          <span>{fmtDate(item.departure_at)} · {fmtTime(item.departure_at)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">Retorno</span>
                          <span>{fmtDate(item.return_at)} · {fmtTime(item.return_at)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">Solicitante</span>
                          <span className="truncate">{item.requester_name || "—"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">Ocupantes</span>
                          <span>{item.passengers} pessoa(s)</span>
                        </div>
                      </div>

                      <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-3">
                        <p className="line-clamp-1 text-xs italic text-muted-foreground">
                          "{item.purpose || "Sem motivo informado"}"
                        </p>
                        <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold">
                          Analisar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Render Ride Card
                return (
                  <div
                    key={item.id}
                    onClick={() => setRideToDecide(item)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:border-warning/50 hover:shadow-md"
                  >
                    <div className="absolute left-0 top-0 h-full w-1 bg-warning" />
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-warning">
                            <AlertCircle className="h-3 w-3" /> CARONA
                          </span>
                          <h3 className="mt-1 font-display text-base font-bold leading-tight group-hover:text-primary">
                            #{item.trip?.code || "—"} · {item.trip?.destination_text || "Viagem removida"}
                          </h3>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">Viagem em</span>
                          <span>{fmtDate(item.trip?.departure_at)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">Horário</span>
                          <span>{fmtTime(item.trip?.departure_at)} — {fmtTime(item.trip?.return_at)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">Solicitante</span>
                          <span className="truncate">{item.requester?.full_name || "—"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">Ocupantes</span>
                          <span>{item.seats} pessoa(s)</span>
                        </div>
                      </div>

                      <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-3">
                        <p className="line-clamp-1 text-xs italic text-muted-foreground">
                          "{item.reason || "Sem motivo informado"}"
                        </p>
                        <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold">
                          Analisar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>

      <AllocateDialog trip={allocating} onClose={() => setAllocating(null)} />
      
      <RideDecisionDialog ride={rideToDecide} onClose={() => setRideToDecide(null)} />

      <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.kind === "REJEITADA" ? "Recusar solicitação" : "Solicitar correção"}
            </DialogTitle>
          </DialogHeader>
          <form
            id="decision-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const reason = String(form.get("reason") ?? "").trim();
              if (reason.length < 5) {
                toast.error("Descreva o motivo para o solicitante.");
                return;
              }
              decide.mutate({ id: decision!.trip.id as string, kind: decision!.kind, reason });
            }}
          >
            <Label htmlFor="reason">Motivo</Label>
            <Textarea id="reason" name="reason" rows={3} maxLength={400} required />
          </form>
          <DialogFooter>
            <Button type="submit" form="decision-form" disabled={decide.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
