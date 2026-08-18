import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, 
  Wrench, 
  Gauge, 
  Info, 
  AlertTriangle, 
  TriangleAlert,
  Calendar,
  Plus
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from "@/integrations/supabase/client"
import {
  fmtDate,
  fmtDateTime,
  fmtKm,
  fmtTime,
  isoToLocalInput,
  localInputToIso,
  todayInput,
  FLEET_STATUS_LABEL,
  calculateAutonomy,
  friendlyDbError,
} from "@/lib/frota";

import { cn } from "@/lib/utils";
import { AuditTimeline } from "@/components/AuditTimeline";
import { VehicleMaintenanceCard } from "@/components/VehicleMaintenanceCard";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";



export const Route = createFileRoute("/_authenticated/admin/veiculos/$vehicleId")({
  component: FichaVeiculo,
});

const STATUSES = [
  "DISPONIVEL",
  "RESERVADO",
  "EM_VIAGEM",
  "EM_MANUTENCAO",
  "INDISPONIVEL",
] as const;
type FleetStatus = (typeof STATUSES)[number];

interface BlockRow {
  id: string;
  block_type: string;
  starts_at: string;
  ends_at: string;
  expected_return_at: string | null;
  finished_at: string | null;
  is_open: boolean;
  workshop: string | null;
  city: string | null;
  service_done: string | null;
  odometer_in: number | null;
  odometer_out: number | null;
  cost: number | null;
  reason: string | null;
  notes: string | null;
}

function FichaVeiculo() {
  const { vehicleId } = Route.useParams();
  const queryClient = useQueryClient();

  const [maintOpen, setMaintOpen] = useState(false);
  const [preventiveOpen, setPreventiveOpen] = useState(false);
  const [selectedMaintType, setSelectedMaintType] = useState<string>('OIL');
  const [finishing, setFinishing] = useState<BlockRow | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<FleetStatus>("DISPONIVEL");

  const invalidate = () => void queryClient.invalidateQueries();

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          *,
          last_oil_change_km, next_oil_change_km, oil_change_date, oil_change_notes,
          last_tire_change_km, next_tire_change_km, tire_change_date, tire_change_notes,
          last_oil_filter_change_km, next_oil_filter_change_km, oil_filter_change_date, oil_filter_change_notes,
          last_air_filter_change_km, next_air_filter_change_km, air_filter_change_date, air_filter_change_notes,
          last_alignment_km, next_alignment_km, alignment_date, alignment_notes,
          last_balancing_km, next_balancing_km, balancing_date, balancing_notes
        `)
        .eq("id", vehicleId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });


  const { data: trips = [] } = useQuery({
    queryKey: ["vehicle-trips", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select("id, code, destination_text, departure_at, return_at, status, requester_name")
        .eq("vehicle_id", vehicleId)
        .order("departure_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["vehicle-blocks", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_blocks")
        .select(
          "id, block_type, starts_at, ends_at, expected_return_at, finished_at, is_open, workshop, city, service_done, odometer_in, odometer_out, cost, reason, notes",
        )
        .eq("vehicle_id", vehicleId)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data as BlockRow[];
    },
  });

  const { data: odometerHistory = [] } = useQuery({
    queryKey: ["vehicle-odometer", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("odometer_history")
        .select("*, profiles(full_name)")
        .eq("vehicle_id", vehicleId)
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: fuels = [] } = useQuery({
    queryKey: ["vehicle-fuel", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_records")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("filled_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const openBlock = blocks.find((b: BlockRow) => b.is_open) ?? null;
  const nowIso = new Date().toISOString();
  const upcoming = useMemo(
    () =>
      trips
        .filter(
          (t: any) =>
            t.return_at >= nowIso &&
            ["APROVADA", "PROGRAMADA", "EM_ANDAMENTO"].includes(t.status),
        )

        .sort((a: any, b: any) => a.departure_at.localeCompare(b.departure_at)),
    [trips, nowIso],
  );

  const startMaintenance = useMutation({
    mutationFn: async (form: FormData) => {
      const startsAt = localInputToIso(String(form.get("starts_at")));
      const expected = String(form.get("expected_return_at") || "");
      const finished = String(form.get("finished_at") || "");
      const endsAt = expected
        ? localInputToIso(expected)
        : new Date(new Date(startsAt).getTime() + 7 * 86_400_000).toISOString();
      const { error } = await supabase.from("vehicle_blocks").insert({
        vehicle_id: vehicleId,
        block_type: "MANUTENCAO",
        starts_at: startsAt,
        ends_at: endsAt,
        expected_return_at: expected ? localInputToIso(expected) : null,
        finished_at: finished ? localInputToIso(finished) : null,
        is_open: !finished,
        workshop: String(form.get("workshop") || "") || null,
        city: String(form.get("city") || "") || null,
        service_done: String(form.get("service_done") || "") || null,
        odometer_in: Number(form.get("odometer_in")) || null,
        cost: Number(form.get("cost")) || null,
        notes: String(form.get("notes") || "") || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Manutenção registrada — o veículo não poderá ser alocado no período.");
      setMaintOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finishMaintenance = useMutation({
    mutationFn: async ({ block, form }: { block: BlockRow; form: FormData }) => {
      const returnedAt = localInputToIso(String(form.get("returned_at")));
      const odometer = Number(form.get("odometer_out")) || null;
      const isPreventive = form.get("is_preventive") === "true";
      
      const { error } = await supabase
        .from("vehicle_blocks")
        .update({
          is_open: false,
          finished_at: returnedAt,
          ends_at: returnedAt,
          odometer_out: odometer,
          service_done: String(form.get("service_done") || "") || block.service_done,
          cost: Number(form.get("cost")) || block.cost,
          notes: String(form.get("notes") || "") || block.notes,
        })
        .eq("id", block.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Manutenção finalizada.");
      setFinishing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(friendlyDbError(e.message)),
  });

  const updateMaintenance = useMutation({
    mutationFn: async (payload: any) => {

      const { error } = await supabase
        .from("vehicles")
        .update(payload)
        .eq("id", vehicleId);
      if (error) throw error;

      // Add to history
      const nextChangeKey = Object.keys(payload).find(k => k.startsWith('next_') && k.endsWith('_km'));
      const maintenanceType = nextChangeKey?.replace('next_', '').replace('_km', '').replace('_change', '');
      
      if (maintenanceType) {
        const dbTypeMap: Record<string, string> = {
          oil: 'OIL',
          tire: 'TIRE',
          oil_filter: 'OIL_FILTER',
          air_filter: 'AIR_FILTER',
          alignment: 'ALIGNMENT',
          balancing: 'BALANCING'
        };
        const dbType = dbTypeMap[maintenanceType] || maintenanceType.toUpperCase();

        await supabase.from("maintenance_history").insert({
          vehicle_id: vehicleId,
          maintenance_type: dbType,
          performed_at_km: vehicle?.odometer ?? 0,
          performed_date: todayInput(),
          next_planned_km: payload[nextChangeKey!],
          notes: payload[`${maintenanceType}_notes`] || 'Atualização manual da próxima manutenção',
        });
      }
    },
    onSuccess: () => {
      toast.success("Manutenção atualizada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(friendlyDbError(e.message)),
  });

  const changeStatus = useMutation({

    mutationFn: async (status: FleetStatus) => {
      const { error } = await supabase
        .from("vehicles")
        .update({ base_status: status })
        .eq("id", vehicleId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      setStatusOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFuel = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase.from("fuel_records").insert({
        vehicle_id: vehicleId,
        filled_at: new Date(String(form.get("filled_at") || todayInput())).toISOString(),
        liters: Number(form.get("liters")) || null,
        total_cost: Number(form.get("total_cost")) || null,
        odometer: Number(form.get("odometer")) || null,
        station: String(form.get("station") || "") || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Abastecimento registrado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title={vehicle ? `${vehicle.manufacturer} ${vehicle.model}` : "Ficha do Veículo"}
      description={vehicle ? `Identificação: ${vehicle.plate}` : "Detalhes operacionais"}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-xl">
            <Link to="/admin/veiculos">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-border/40"
            onClick={() => {
              setNextStatus((vehicle?.base_status as FleetStatus) ?? "DISPONIVEL");
              setStatusOpen(true);
            }}
          >
            Alterar Status
          </Button>
          {openBlock ? (
            <Button size="sm" className="rounded-xl shadow-lg shadow-primary/20" onClick={() => setFinishing(openBlock)}>
              <Wrench className="mr-1.5 h-4 w-4" /> Finalizar Manutenção
            </Button>
          ) : (
            <Button size="sm" className="rounded-xl shadow-lg shadow-primary/20" onClick={() => setMaintOpen(true)}>
              <Wrench className="mr-1.5 h-4 w-4" /> Abrir Manutenção
            </Button>
          )}
        </div>
      }
    >
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <StatusBadge status={vehicle?.base_status ?? "DISPONIVEL"} kind="fleet" className="px-4 py-1.5" />
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
           <span>{vehicle?.capacity ?? "—"} lugares</span>
           <div className="h-1 w-1 rounded-full bg-border" />
           <span>{vehicle?.fuel ?? "—"}</span>
           <div className="h-1 w-1 rounded-full bg-border" />
           <span className={cn(vehicle?.is_active ? "text-success" : "text-destructive")}>
             {vehicle?.is_active ? "Veículo Ativo" : "Veículo Inativo"}
           </span>
        </div>
      </div>


      <Tabs defaultValue="geral">
        <TabsList className="flex-wrap">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="viagens">Viagens</TabsTrigger>
          <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
          <TabsTrigger value="abastecimento">Abastecimento</TabsTrigger>
          <TabsTrigger value="hodometro">Hodômetro</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-bold uppercase tracking-wider">Dados do Veículo</CardTitle>
                <div className="rounded-full bg-primary/10 p-2">
                  <Info className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {[
                    ["Placa", <span className="rounded bg-muted px-2 py-0.5 font-bold ring-1 ring-border">{vehicle?.plate}</span>],
                    ["Marca / Fabricante", vehicle?.manufacturer],
                    ["Modelo", vehicle?.model],
                    ["Ano / Modelo", vehicle?.year ?? "—"],
                    ["Tipo de Veículo", vehicle?.vehicle_type ?? "—"],
                    ["Combustível", vehicle?.fuel ?? "—"],
                    ["Capacidade", `${vehicle?.capacity ?? "—"} pessoas`],
                    ["Patrimônio / ID", vehicle?.asset_number ?? "—"],
                    ["Hodômetro Atual", <span className="flex items-center gap-1 font-bold text-primary"><Gauge className="h-3.5 w-3.5" /> {fmtKm(vehicle?.odometer)}</span>],
                    ["Status Operacional", <StatusBadge status={vehicle?.base_status ?? "DISPONIVEL"} kind="fleet" className="h-5" />],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between gap-4 border-b border-border/50 py-2.5">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right font-medium">{value ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold uppercase tracking-wider">Manutenção Preventiva</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                  <VehicleMaintenanceCard vehicle={vehicle} />
                 
                 <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 text-xs text-warning-foreground">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Aviso de Segurança
                    </div>
                    As revisões devem ser realizadas rigorosamente conforme o manual do fabricante ou a cada 10.000km rodados.
                 </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold uppercase tracking-wider">Observações Adicionais</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">
                {vehicle?.notes || "Nenhuma observação registrada para este veículo."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nenhuma viagem futura para este veículo.
            </p>
          ) : (
            <ul className="grid gap-3">
              {upcoming.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      #{t.code} · {t.destination_text}
                    </p>
                    <p className="text-muted-foreground">
                      {fmtDate(t.departure_at)} · {fmtTime(t.departure_at)} —{" "}
                      {fmtTime(t.return_at)} · {t.requester_name ?? "—"}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="viagens" className="mt-4">
          {trips.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Sem viagens registradas.
            </p>
          ) : (
            <ul className="grid gap-3">
              {trips.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      #{t.code} · {t.destination_text}
                    </p>
                    <p className="text-muted-foreground">
                      {fmtDateTime(t.departure_at)} · {t.requester_name ?? "—"}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="manutencao" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Status atual: <strong className="text-foreground">
                {FLEET_STATUS_LABEL[vehicle?.base_status ?? "DISPONIVEL"]}
              </strong>
            </p>
            <Button size="sm" variant="outline" onClick={() => setMaintOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Registrar manutenção
            </Button>
          </div>

          {openBlock ? (
            <Card className="border-warning/40">
              <CardHeader>
                <CardTitle className="text-base">Manutenção atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Entrada: {fmtDateTime(openBlock.starts_at)} · Previsão de retorno:{" "}
                  {openBlock.expected_return_at
                    ? fmtDateTime(openBlock.expected_return_at)
                    : fmtDateTime(openBlock.ends_at)}
                </p>
                <p className="text-muted-foreground">
                  {openBlock.workshop ?? "Oficina não informada"}
                  {openBlock.city ? ` · ${openBlock.city}` : ""}
                </p>
                {openBlock.service_done ? <p>{openBlock.service_done}</p> : null}
                <Button size="sm" onClick={() => setFinishing(openBlock)}>
                  Finalizar manutenção
                </Button>
              </CardContent>
            </Card>
          ) : null}




          <Card>
            <CardHeader>
              <CardTitle className="text-base">Controle de Manutenções Preventivas</CardTitle>
            </CardHeader>
            <CardContent>
              {!vehicle ? (
                <p className="text-sm text-muted-foreground">Carregando dados do veículo...</p>
              ) : (
                <>
                  <ul className="space-y-6">
                    {[
                      { id: 'oil', label: 'Óleo', lastKm: vehicle?.last_oil_change_km, nextKm: vehicle?.next_oil_change_km, date: vehicle?.oil_change_date, notes: vehicle?.oil_change_notes },
                      { id: 'tire', label: 'Pneus', lastKm: vehicle?.last_tire_change_km, nextKm: vehicle?.next_tire_change_km, date: vehicle?.tire_change_date, notes: vehicle?.tire_change_notes },
                      { id: 'oil_filter', label: 'Filtro de Óleo', lastKm: vehicle?.last_oil_filter_change_km, nextKm: vehicle?.next_oil_filter_change_km, date: vehicle?.oil_filter_change_date, notes: vehicle?.oil_filter_change_notes },
                      { id: 'air_filter', label: 'Filtro de Ar', lastKm: vehicle?.last_air_filter_change_km, nextKm: vehicle?.next_air_filter_change_km, date: vehicle?.air_filter_change_date, notes: vehicle?.air_filter_change_notes },
                      { id: 'alignment', label: 'Alinhamento', lastKm: vehicle?.last_alignment_km, nextKm: vehicle?.next_alignment_km, date: vehicle?.alignment_date, notes: vehicle?.alignment_notes },
                      { id: 'balancing', label: 'Balanceamento', lastKm: vehicle?.last_balancing_km, nextKm: vehicle?.next_balancing_km, date: vehicle?.balancing_date, notes: vehicle?.balancing_notes },
                    ].map((item) => (
                      <li key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">


                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <h4 className="font-display text-base font-bold uppercase tracking-tight text-primary">
                            {item.label}
                          </h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>Última: <strong>{fmtKm(item.lastKm)}</strong></span>
                            <span>Data: <strong>{fmtDate(item.date)}</strong></span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>Próxima: <strong>{fmtKm(item.nextKm)}</strong></span>
                            {item.nextKm && item.lastKm && (
                              <span>Intervalo: <strong>{fmtKm(item.nextKm - item.lastKm)}</strong></span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2 self-end sm:self-auto">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="rounded-xl border-border/40"
                            onClick={() => {
                              setSelectedMaintType(
                                item.id === 'oil' ? 'OIL' :
                                item.id === 'tire' ? 'TIRE' :
                                item.id === 'oil_filter' ? 'OIL_FILTER' :
                                item.id === 'air_filter' ? 'AIR_FILTER' :
                                item.id === 'alignment' ? 'ALIGNMENT' : 'BALANCING'
                              );
                              setPreventiveOpen(true);
                            }}
                          >
                            <Plus className="mr-1 h-3 w-3" /> Registrar Realizada
                          </Button>
                          <div className="flex flex-col gap-1 min-w-[120px]">
                            <Input 
                                id={`next-${item.id}`}
                                type="number"
                                className="h-9 font-mono font-bold"
                                defaultValue={item.nextKm || 0}
                                onBlur={(e) => {
                                  const val = Number(e.target.value);
                                  if (val !== item.nextKm) {
                                    const key = 
                                      item.id === 'oil' || item.id === 'tire' || 
                                      item.id === 'oil_filter' || item.id === 'air_filter' 
                                        ? `next_${item.id}_change_km` 
                                        : `next_${item.id}_km`;
                                    updateMaintenance.mutate({ [key]: val });
                                  }
                                }}
                            />
                            <span className="text-[8px] font-bold uppercase text-center text-muted-foreground">Limiar Próxima (KM)</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between mb-1.5 text-xs font-medium">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className={cn(
                            "font-bold",
                            (vehicle?.odometer ?? 0) >= (item.nextKm ?? 0) && (item.nextKm ?? 0) > 0 ? "text-destructive" :
                            (vehicle?.odometer ?? 0) >= (item.nextKm ?? 0) - 500 && (item.nextKm ?? 0) > 0 ? "text-warning" : "text-success"
                          )}>
                            {!(item.nextKm) || (item.nextKm === 0) ? "Não configurado" :
                             (vehicle?.odometer ?? 0) >= (item.nextKm ?? 0)
                              ? `MANUTENÇÃO VENCIDA (${((vehicle?.odometer ?? 0) - (item.nextKm ?? 0)).toLocaleString()} km acima)`
                              : `${((item.nextKm ?? 0) - (vehicle?.odometer ?? 0)).toLocaleString()} km restantes`}
                          </span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-muted/40 border border-border/10">
                          <div 
                            className={cn(
                              "h-full transition-all duration-1000",
                              (vehicle?.odometer ?? 0) >= (item.nextKm ?? 0) && (item.nextKm ?? 0) > 0 ? "bg-destructive animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" :
                              (item.nextKm && item.lastKm && ((vehicle.odometer - item.lastKm) / (item.nextKm - item.lastKm)) >= 0.9) ? "bg-destructive" :
                              (item.nextKm && item.lastKm && ((vehicle.odometer - item.lastKm) / (item.nextKm - item.lastKm)) >= 0.7) ? "bg-warning" : "bg-success"
                            )}
                            style={{ 
                              width: `${Math.max(0, Math.min(100, 
                                (vehicle?.odometer ?? 0) >= (item.nextKm ?? 0) && (item.nextKm ?? 0) > 0 ? 100 :
                                item.nextKm && item.lastKm && item.nextKm > item.lastKm
                                  ? ((vehicle.odometer - item.lastKm) / (item.nextKm - item.lastKm)) * 100
                                  : 0
                              ))}%` 
                            }}
                          />
                        </div>
                      </div>

                      {item.notes && (
                        <p className="mt-3 text-xs italic text-muted-foreground border-t border-border/50 pt-2">
                          Obs: {item.notes}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                <Separator className="my-8" />

                <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Registros de Oficina</h3>
                <ul className="space-y-3 text-sm">
                  {blocks.map((b: BlockRow) => (

                    <li key={b.id} className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {b.block_type === "MANUTENCAO" ? "Manutenção" : "Indisponível"}
                          {b.workshop ? ` · ${b.workshop}` : ""}
                        </p>
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          {b.is_open ? "Em aberto" : "Encerrada"}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        Entrada {fmtDateTime(b.starts_at)} · Retorno{" "}
                        {b.finished_at ? fmtDateTime(b.finished_at) : "—"}
                        {b.city ? ` · ${b.city}` : ""}
                      </p>
                      {b.service_done ? <p className="mt-1">{b.service_done}</p> : null}
                      {b.cost ? (
                        <p className="text-muted-foreground">Custo: R$ {b.cost}</p>
                      ) : null}
                    </li>
                  ))}
                  </ul>
                </>
              )}



            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="abastecimento" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar abastecimento</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addFuel.mutate(new FormData(e.currentTarget));
                  e.currentTarget.reset();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="f-date">Data</Label>
                  <Input id="f-date" name="filled_at" type="date" defaultValue={todayInput()} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="f-liters">Litros</Label>
                  <Input id="f-liters" name="liters" type="number" step="0.01" min={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="f-cost">Valor total (R$)</Label>
                  <Input id="f-cost" name="total_cost" type="number" step="0.01" min={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="f-odo">Hodômetro</Label>
                  <Input id="f-odo" name="odometer" type="number" min={0} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="f-station">Posto</Label>
                  <Input id="f-station" name="station" maxLength={80} />
                </div>
                <Button type="submit" className="sm:col-span-2" disabled={addFuel.isPending}>
                  Registrar
                </Button>
              </form>

              <ul className="mt-4 space-y-2 text-sm">
                {fuels.map((f) => (
                  <li key={f.id} className="flex justify-between border-b border-border pb-1">
                    <span>{fmtDate(f.filled_at)}</span>
                    <span className="text-muted-foreground">
                      {f.liters ? `${f.liters} L` : "—"}
                      {f.total_cost ? ` · R$ ${f.total_cost}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Alterações</CardTitle>
            </CardHeader>
            <CardContent>
               <AuditTimeline entityId={vehicleId} entityType="user" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico consolidado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Manutenção Preventiva</span>
                  <span>{fmtKm(vehicle?.odometer)} / {fmtKm(vehicle?.next_preventive_km)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                  <div 
                    className={cn(
                      "h-full transition-all",
                      (vehicle?.odometer ?? 0) >= (vehicle?.next_preventive_km ?? 0) - 500 ? "bg-destructive" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(100, ((vehicle?.odometer ?? 0) / (vehicle?.next_preventive_km || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-accent/50 p-3">
                  <p className="text-xs text-muted-foreground">Consumo Médio</p>
                  <p className="text-lg font-semibold">{calculateAutonomy(fuels)}</p>
                </div>
                <div className="rounded-lg bg-accent/50 p-3">
                  <p className="text-xs text-muted-foreground">Viagens / Manutenções</p>
                  <p className="text-lg font-semibold">{trips.length} / {blocks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      <TabsContent value="hodometro" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold uppercase tracking-wider">Histórico do Hodômetro</CardTitle>
              <Gauge className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {odometerHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum histórico de quilometragem registrado.</p>
              ) : (
                <div className="relative overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Data/Hora</th>
                        <th className="px-4 py-3 text-right">Anterior</th>
                        <th className="px-4 py-3 text-right">Novo</th>
                        <th className="px-4 py-3 text-right">Percurso</th>
                        <th className="px-4 py-3">Origem</th>
                        <th className="px-4 py-3">Registrado por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {odometerHistory.map((h: any) => (
                        <tr key={h.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(h.recorded_at)}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">{h.old_value?.toLocaleString() ?? "—"} km</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">{h.new_value.toLocaleString()} km</td>
                          <td className="px-4 py-3 text-right font-mono text-primary">
                            {h.old_value ? `+${(h.new_value - h.old_value).toLocaleString()} km` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset",
                              h.origin === 'trip_start' ? "bg-info/10 text-info ring-info/30" :
                              h.origin === 'trip_end' ? "bg-success/10 text-success ring-success/30" :
                              h.origin === 'manual' ? "bg-warning/10 text-warning ring-warning/30" :
                              "bg-muted text-muted-foreground ring-border"
                            )}>
                              {h.origin === 'trip_start' ? "Saída Viagem" :
                               h.origin === 'trip_end' ? "Retorno Viagem" :
                               h.origin === 'manual' ? "Manual" :
                               h.origin === 'maintenance' ? "Manutenção" :
                               h.origin === 'fuel' ? "Abastecimento" : h.origin}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{h.profiles?.full_name || "Sistema"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar manutenção</DialogTitle>
          </DialogHeader>

          {upcoming.length > 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="font-semibold text-foreground">
                  ATENÇÃO: este veículo possui viagens programadas durante o período de manutenção.
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {upcoming.slice(0, 5).map((t: any) => (
                    <li key={t.id}>
                      #{t.code} · {t.destination_text} · {fmtDateTime(t.departure_at)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-muted-foreground">
                  As viagens não são canceladas automaticamente — realoque outro veículo em
                  Aprovações.
                </p>
              </div>
            </div>
          ) : null}

          <form
            id="maint-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              startMaintenance.mutate(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="m-start">Data de entrada</Label>
              <Input
                id="m-start"
                name="starts_at"
                type="datetime-local"
                required
                defaultValue={isoToLocalInput(new Date().toISOString())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-expected">Previsão de retorno</Label>
              <Input id="m-expected" name="expected_return_at" type="datetime-local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-finished">Retorno efetivo (opcional)</Label>
              <Input id="m-finished" name="finished_at" type="datetime-local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-workshop">Estabelecimento/oficina</Label>
              <Input id="m-workshop" name="workshop" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-city">Cidade</Label>
              <Input id="m-city" name="city" maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-odo">Quilometragem</Label>
              <Input id="m-odo" name="odometer_in" type="number" min={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-cost">Custo (R$) — opcional</Label>
              <Input id="m-cost" name="cost" type="number" step="0.01" min={0} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="m-service">Serviço realizado</Label>
              <Textarea id="m-service" name="service_done" rows={2} maxLength={600} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="m-notes">Observações</Label>
              <Textarea id="m-notes" name="notes" rows={2} maxLength={600} />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="maint-form" disabled={startMaintenance.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(finishing)} onOpenChange={(o) => !o && setFinishing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar manutenção</DialogTitle>
          </DialogHeader>
          <form
            id="finish-form"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (finishing) {
                finishMaintenance.mutate({ block: finishing, form: new FormData(e.currentTarget) });
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="fm-date">Data de retorno</Label>
              <Input
                id="fm-date"
                name="returned_at"
                type="datetime-local"
                required
                defaultValue={isoToLocalInput(new Date().toISOString())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fm-odo">Quilometragem atual</Label>
              <Input
                id="fm-odo"
                name="odometer_out"
                type="number"
                min={0}
                defaultValue={vehicle?.odometer ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fm-service">Serviço realizado</Label>
              <Textarea
                id="fm-service"
                name="service_done"
                rows={2}
                maxLength={600}
                defaultValue={finishing?.service_done ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fm-cost">Custo final (R$)</Label>
              <Input id="fm-cost" name="cost" type="number" step="0.01" min={0} />
            </div>
            <div className="flex items-center space-x-2 py-2">
              <input type="checkbox" id="fm-preventive" name="is_preventive" value="true" className="h-4 w-4 rounded border-border" />
              <Label htmlFor="fm-preventive" className="font-normal">Esta manutenção é uma revisão preventiva (reseta km)</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fm-notes">Observações</Label>
              <Textarea id="fm-notes" name="notes" rows={2} maxLength={600} />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="finish-form" disabled={finishMaintenance.isPending}>
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={preventiveOpen} onOpenChange={setPreventiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Manutenção Realizada</DialogTitle>
          </DialogHeader>
          <form
            id="preventive-form"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              registerMaintenance.mutate(new FormData(e.currentTarget));
            }}
          >
            <input type="hidden" name="type" value={selectedMaintType} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Manutenção</Label>
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm font-bold text-primary">
                  {selectedMaintType === 'OIL' ? 'Óleo' :
                   selectedMaintType === 'TIRE' ? 'Pneus' :
                   selectedMaintType === 'OIL_FILTER' ? 'Filtro de Óleo' :
                   selectedMaintType === 'AIR_FILTER' ? 'Filtro de Ar' :
                   selectedMaintType === 'ALIGNMENT' ? 'Alinhamento' : 'Balanceamento'}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-date">Data da Realização</Label>
                <Input id="p-date" name="performed_date" type="date" required defaultValue={todayInput()} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-performed-km">KM da Realização</Label>
                <Input 
                  id="p-performed-km" 
                  name="performed_km" 
                  type="number" 
                  required 
                  defaultValue={vehicle?.odometer ?? 0}
                  placeholder="Ex: 158000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-next-km">KM da Próxima Manutenção</Label>
                <Input 
                  id="p-next-km" 
                  name="next_km" 
                  type="number" 
                  required 
                  placeholder="Ex: 164000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-notes">Observações</Label>
              <Textarea id="p-notes" name="notes" placeholder="Descreva os detalhes da manutenção..." rows={3} />
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-[10px] text-muted-foreground uppercase leading-relaxed">
              Ao confirmar, o sistema atualizará a "Última Manutenção" e a "Próxima Manutenção" do veículo, recalculando o progresso automaticamente.
            </div>
          </form>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreventiveOpen(false)}>Cancelar</Button>
            <Button type="submit" form="preventive-form" disabled={registerMaintenance.isPending}>
              {registerMaintenance.isPending ? "Salvando..." : "Confirmar Registro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
