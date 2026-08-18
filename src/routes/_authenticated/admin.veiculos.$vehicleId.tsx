import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, TriangleAlert, Wrench, Fuel, Activity, History } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/lib/frota";
import { cn } from "@/lib/utils";
import { AuditTimeline } from "@/components/AuditTimeline";

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
  const [finishing, setFinishing] = useState<BlockRow | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<FleetStatus>("DISPONIVEL");

  const invalidate = () => void queryClient.invalidateQueries();

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, next_preventive_km, preventive_km_interval")
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

  const openBlock = blocks.find((b) => b.is_open) ?? null;
  const nowIso = new Date().toISOString();
  const upcoming = useMemo(
    () =>
      trips
        .filter(
          (t) =>
            t.return_at >= nowIso &&
            ["APROVADA", "PROGRAMADA", "EM_ANDAMENTO"].includes(t.status),
        )
        .sort((a, b) => a.departure_at.localeCompare(b.departure_at)),
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

      if (odometer && odometer > (vehicle?.odometer ?? 0)) {
        const updateData: any = { odometer };
        if (isPreventive) {
          updateData.next_preventive_km = odometer + (vehicle?.preventive_km_interval ?? 10000);
        }
        const { error: odoError } = await supabase
          .from("vehicles")
          .update(updateData)
          .eq("id", vehicleId);
        if (odoError) throw new Error(odoError.message);
      }

      const { data: remaining, error: remainingError } = await supabase
        .from("vehicle_blocks")
        .select("id")
        .eq("vehicle_id", vehicleId)
        .eq("is_open", true);
      if (remainingError) throw new Error(remainingError.message);
      if ((remaining ?? []).length === 0) {
        const { error: statusError } = await supabase
          .from("vehicles")
          .update({ base_status: "DISPONIVEL" })
          .eq("id", vehicleId);
        if (statusError) throw new Error(statusError.message);
      }
    },
    onSuccess: () => {
      toast.success("Manutenção finalizada.");
      setFinishing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
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
      title={vehicle ? `${vehicle.manufacturer} ${vehicle.model}` : "Veículo"}
      description={vehicle ? `Placa ${vehicle.plate}` : "Ficha do veículo"}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/veiculos">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNextStatus((vehicle?.base_status as FleetStatus) ?? "DISPONIVEL");
              setStatusOpen(true);
            }}
          >
            Alterar status
          </Button>
          {openBlock ? (
            <Button size="sm" onClick={() => setFinishing(openBlock)}>
              <Wrench className="mr-1 h-4 w-4" /> Finalizar manutenção
            </Button>
          ) : (
            <Button size="sm" onClick={() => setMaintOpen(true)}>
              <Wrench className="mr-1 h-4 w-4" /> Colocar em manutenção
            </Button>
          )}
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={vehicle?.base_status ?? "DISPONIVEL"} kind="fleet" />
        <span className="text-sm text-muted-foreground">
          {vehicle?.capacity ?? "—"} lugares · {vehicle?.fuel ?? "—"} ·{" "}
          {vehicle?.is_active ? "Ativo" : "Inativo"}
        </span>
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="flex-wrap">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="viagens">Viagens</TabsTrigger>
          <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
          <TabsTrigger value="abastecimento">Abastecimento</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do veículo</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {[
                  ["Placa", vehicle?.plate],
                  ["Fabricante", vehicle?.manufacturer],
                  ["Modelo", vehicle?.model],
                  ["Ano", vehicle?.year ?? "—"],
                  ["Tipo", vehicle?.vehicle_type ?? "—"],
                  ["Combustível", vehicle?.fuel ?? "—"],
                  ["Lugares", vehicle?.capacity ?? "—"],
                  ["Patrimônio", vehicle?.asset_number ?? "—"],
                  ["Hodômetro", fmtKm(vehicle?.odometer)],
                  ["Próxima Revisão", vehicle?.next_preventive_km ? `${fmtKm(vehicle.next_preventive_km)} (${fmtKm(vehicle.next_preventive_km - (vehicle.odometer ?? 0))} restantes)` : "—"],
                  ["Observações", vehicle?.notes ?? "—"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-4 border-b border-border py-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right">{String(value ?? "—")}</dd>
                  </div>
                ))}
              </dl>
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
              <CardTitle className="text-base">Histórico de manutenções</CardTitle>
            </CardHeader>
            <CardContent>
              {blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {blocks.map((b) => (
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
                  {upcoming.slice(0, 5).map((t) => (
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

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar status do veículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="v-status">Status operacional</Label>
            <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as FleetStatus)}>
              <SelectTrigger id="v-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {FLEET_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={() => changeStatus.mutate(nextStatus)} disabled={changeStatus.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
