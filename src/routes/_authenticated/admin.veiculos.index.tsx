import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { 
  CalendarRange, 
  FileText, 
  Pencil, 
  Plus, 
  Trash2, 
  Wrench, 
  Gauge, 
  Fuel, 
  Users, 
  ChevronRight,
  Info,
  CarFront
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { fmtDateTime, fmtKm, isoToLocalInput, localInputToIso, FLEET_STATUS_LABEL } from "@/lib/frota";
import { VehicleMaintenanceCard } from "@/components/VehicleMaintenanceCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/veiculos/")({
  component: Veiculos,
});

interface VehicleRow {
  id: string;
  plate: string;
  manufacturer: string;
  model: string;
  year: number | null;
  vehicle_type: string | null;
  fuel: string | null;
  capacity: number;
  asset_number: string | null;
  odometer: number;
  notes: string | null;
  is_active: boolean;
  last_oil_change_km?: number | null;
  next_oil_change_km?: number | null;
  last_tire_change_km?: number | null;
  next_tire_change_km?: number | null;
  last_alignment_km?: number | null;
  next_alignment_km?: number | null;
  last_balancing_km?: number | null;
  next_balancing_km?: number | null;
}

const VEHICLE_TYPES = ["CARRO", "VAN", "MICRO-ONIBUS", "ONIBUS", "CAMINHONETE", "OUTRO"] as const;
const FUELS = ["Flex", "Gasolina", "Etanol", "Diesel", "Elétrico", "Híbrido"] as const;

const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(7, { message: "Placa inválida" })
    .max(10)
    .transform((v) => v.toUpperCase().replace(/\s/g, "")),
  manufacturer: z.string().trim().min(2, { message: "Informe a marca" }).max(60),
  model: z.string().trim().min(1, { message: "Informe o modelo" }).max(60),
  capacity: z.coerce.number().int().min(1).max(60),
  year: z.coerce.number().int().min(1980).max(2100).optional(),
  asset_number: z.string().trim().max(30).optional(),
  odometer: z.coerce.number().int().min(0).max(2_000_000),
  notes: z.string().trim().max(600).optional(),
});

function Veiculos() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch() as { filter?: string; pending?: string };

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleRow | null>(null);
  const [removing, setRemoving] = useState<VehicleRow | null>(null);
  const [maintenance, setMaintenance] = useState<VehicleRow | null>(null);
  const [formType, setFormType] = useState<string>("CARRO");
  const [formFuel, setFormFuel] = useState<string>("Flex");
  const [statusFor, setStatusFor] = useState<VehicleRow | null>(null);
  const [nextStatus, setNextStatus] = useState<string>("DISPONIVEL");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(
          "id, plate, manufacturer, model, year, vehicle_type, fuel, capacity, asset_number, odometer, notes, is_active, base_status, last_oil_change_km, next_oil_change_km, last_tire_change_km, next_tire_change_km, last_alignment_km, next_alignment_km, last_balancing_km, next_balancing_km",
        )
        .order("plate");
      if (error) throw error;
      return data as VehicleRow[];
    },
  });

  const { data: fleet = [] } = useQuery({
    queryKey: ["fleet-now"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fleet_now");
      if (error) throw error;
      return data;
    },
  });

  const { data: openBlocks = [] } = useQuery({
    queryKey: ["open-maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_blocks")
        .select("id, vehicle_id, block_type, starts_at, ends_at, is_open, reason, workshop")
        .eq("is_open", true);
      if (error) throw error;
      return data;
    },
  });

  const statusByVehicle = useMemo(
    () => new Map(fleet.map((f) => [f.vehicle_id, f])),
    [fleet],
  );
  const blockByVehicle = useMemo(
    () => new Map(openBlocks.map((b) => [b.vehicle_id, b])),
    [openBlocks],
  );

  const invalidate = () => void queryClient.invalidateQueries();

  const save = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: z.infer<typeof vehicleSchema> }) => {
      const values = {
        plate: payload.plate,
        manufacturer: payload.manufacturer,
        model: payload.model,
        capacity: payload.capacity,
        year: payload.year ?? null,
        vehicle_type: formType,
        fuel: formFuel,
        asset_number: payload.asset_number ?? null,
        odometer: payload.odometer,
        notes: payload.notes ?? null,
      };
      const { error } = id
        ? await supabase.from("vehicles").update(values).eq("id", id)
        : await supabase.from("vehicles").insert(values);
      if (error) {
        throw new Error(
          error.message.includes("duplicate") || error.message.includes("unique")
            ? "Já existe um veículo com esta placa."
            : error.message,
        );
      }
    },
    onSuccess: () => {
      toast.success("Veículo salvo.");
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("vehicles").update({ is_active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("vehicles")
        .update({
          base_status: status as "DISPONIVEL" | "RESERVADO" | "EM_VIAGEM" | "EM_MANUTENCAO" | "INDISPONIVEL",
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      setStatusFor(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Veículo excluído.");
      setRemoving(null);
      invalidate();
    },
    onError: () => {
      toast.error(
        "Este veículo possui viagens ou registros vinculados. Desative-o em vez de excluir.",
      );
      setRemoving(null);
    },
  });

  const startMaintenance = useMutation({
    mutationFn: async ({
      vehicleId,
      endsAt,
      workshop,
      reason,
    }: {
      vehicleId: string;
      endsAt: string;
      workshop: string;
      reason: string;
    }) => {
      const { error } = await supabase.from("vehicle_blocks").insert({
        vehicle_id: vehicleId,
        block_type: "MANUTENCAO",
        starts_at: new Date().toISOString(),
        ends_at: endsAt,
        workshop: workshop || null,
        reason: reason || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Veículo enviado para manutenção — não poderá ser alocado no período.");
      setMaintenance(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const endMaintenance = useMutation({
    mutationFn: async (blockId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("vehicle_blocks")
        .update({ ends_at: now, finished_at: now, is_open: false })
        .eq("id", blockId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Manutenção encerrada — veículo liberado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openForm(row: VehicleRow | null) {
    setEditing(row);
    setFormType(row?.vehicle_type ?? "CARRO");
    setFormFuel(row?.fuel ?? "Flex");
    setFormOpen(true);
  }

  const filteredVehicles = useMemo(() => {
    if (isLoading) return [];
    
    return vehicles.filter(v => {
      const matchesSearch = 
        v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchTerm.toLowerCase());
      
      const maintenanceStatus = (v as any).maintenance_status;
      // Explicitly check for 'pending' or 'true' to support both types of URL params
      const isPendingRequested = search?.filter === 'pending' || search?.pending === 'true';
      
      const matchesFilter = isPendingRequested
        ? (maintenanceStatus === 'VENCIDA' || maintenanceStatus === 'CRÍTICO')
        : true;

      return matchesSearch && matchesFilter;
    });
  }, [vehicles, searchTerm, search?.filter, search?.pending, isLoading]);

  return (
    <AppShell
      title="Gestão da Frota"
      description="Controle operacional, disponibilidade e manutenção preventiva."
      actions={
        <div className="flex items-center gap-2">
          <Input 
            placeholder="Buscar veículo..." 
            className="h-9 w-48 rounded-xl bg-background/50" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button size="sm" onClick={() => openForm(null)} className="rounded-xl shadow-lg shadow-primary/20">
            <Plus className="mr-1.5 h-4 w-4" /> Novo Veículo
          </Button>
        </div>
      }
    >

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">Carregando veículos...</p>
        </div>
      ) : filteredVehicles.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* ... existing vehicle cards mapping ... */}

          {filteredVehicles.map((v) => {
            const status = statusByVehicle.get(v.id);
            const block = blockByVehicle.get(v.id);
            return (
              <li 
                key={v.id} 
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/40 bg-card/60 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:border-primary/20 hover:-translate-y-1 cursor-pointer"
                onClick={() => navigate({ to: "/admin/veiculos/$vehicleId", params: { vehicleId: v.id } })}
              >


                
                <div className="relative z-10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-lg font-bold tracking-tight text-foreground">
                          {v.manufacturer} {v.model}
                        </p>
                        <StatusBadge
                          status={v.is_active ? (status?.status ?? "DISPONIVEL") : "INATIVO"}
                          kind="fleet"
                          className="h-5"
                        />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold text-foreground ring-1 ring-border">
                          {v.plate}
                        </span>
                        {v.year ? ` · ${v.year}` : ""}
                        {v.asset_number ? ` · Pat: ${v.asset_number}` : ""}
                      </p>
                    </div>
                    <div className="hidden group-hover:block">
                       <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Gauge className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hodômetro</p>
                        <p className="text-sm font-semibold">{fmtKm(v.odometer)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-success/10 p-2">
                        <Users className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Capacidade</p>
                        <p className="text-sm font-semibold">{v.capacity} lug.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-warning/10 p-2">
                        <Fuel className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Combustível</p>
                        <p className="text-sm font-semibold">{v.fuel || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-info/10 p-2">
                        <Info className="h-4 w-4 text-info" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</p>
                        <p className="text-sm font-semibold truncate max-w-[80px]">{v.vehicle_type || "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <VehicleMaintenanceCard vehicle={v} compact />
                    
                    <div className="space-y-1 rounded-md border border-border/40 bg-muted/20 p-2.5 text-xs text-muted-foreground">
                      <p className="flex justify-between">
                        <span>Próxima viagem:</span>
                        <span className="font-medium text-foreground">
                          {status?.next_trip_at
                            ? `${fmtDateTime(status.next_trip_at)}`
                            : "nenhuma"}
                        </span>
                      </p>
                      {block && (
                        <p className="flex justify-between text-warning">
                          <span>Em manutenção:</span>
                          <span className="font-medium truncate ml-2">{block.workshop || "Oficina"}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="relative z-20 mt-auto grid grid-cols-2 divide-x divide-border border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="rounded-none h-10 text-xs hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      openForm(v);
                    }}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="rounded-none h-10 text-xs hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNextStatus(status?.status ?? "DISPONIVEL");
                      setStatusFor(v);
                    }}
                  >
                    <Wrench className="mr-1.5 h-3.5 w-3.5" /> Status
                  </Button>
                </div>

              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <CarFront className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Nenhum veículo encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
            Não encontramos veículos cadastrados ou correspondentes aos filtros aplicados.
          </p>
          {(searchTerm || search?.filter || search?.pending) && (
            <Button 
              variant="outline" 
              className="mt-6 rounded-xl"
              onClick={() => {
                setSearchTerm("");
                navigate({ to: "/admin/veiculos", search: {} });
              }}
            >
              Limpar busca e filtros
            </Button>
          )}
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar veículo" : "Cadastrar veículo"}</DialogTitle>
          </DialogHeader>
          <form
            id="vehicle-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const parsed = vehicleSchema.safeParse({
                plate: form.get("plate"),
                manufacturer: form.get("manufacturer"),
                model: form.get("model"),
                capacity: form.get("capacity"),
                year: form.get("year") || undefined,
                asset_number: form.get("asset_number") || undefined,
                odometer: form.get("odometer") || 0,
                notes: form.get("notes") || undefined,
              });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
                return;
              }
              save.mutate({ ...(editing ? { id: editing.id } : {}), payload: parsed.data });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="v-plate">Placa</Label>
              <Input
                id="v-plate"
                name="plate"
                required
                maxLength={10}
                defaultValue={editing?.plate ?? ""}
                placeholder="ABC1D23"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-asset">Nº patrimônio</Label>
              <Input
                id="v-asset"
                name="asset_number"
                maxLength={30}
                defaultValue={editing?.asset_number ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-manufacturer">Marca</Label>
              <Input
                id="v-manufacturer"
                name="manufacturer"
                required
                maxLength={60}
                defaultValue={editing?.manufacturer ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-model">Modelo</Label>
              <Input
                id="v-model"
                name="model"
                required
                maxLength={60}
                defaultValue={editing?.model ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-type">Tipo</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger id="v-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-fuel">Combustível</Label>
              <Select value={formFuel} onValueChange={setFormFuel}>
                <SelectTrigger id="v-fuel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUELS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-capacity">Lugares</Label>
              <Input
                id="v-capacity"
                name="capacity"
                type="number"
                min={1}
                defaultValue={editing?.capacity ?? 5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-year">Ano</Label>
              <Input
                id="v-year"
                name="year"
                type="number"
                min={1980}
                max={2100}
                defaultValue={editing?.year ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-odometer">Hodômetro (km)</Label>
              <Input
                id="v-odometer"
                name="odometer"
                type="number"
                min={0}
                defaultValue={editing?.odometer ?? 0}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="v-notes">Observações</Label>
              <Textarea
                id="v-notes"
                name="notes"
                rows={2}
                maxLength={600}
                defaultValue={editing?.notes ?? ""}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="vehicle-form" disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(maintenance)} onOpenChange={(o) => !o && setMaintenance(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para manutenção</DialogTitle>
          </DialogHeader>
          <form
            id="maint-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const ends = String(form.get("ends_at") ?? "");
              if (!ends) {
                toast.error("Informe a previsão de retorno.");
                return;
              }
              startMaintenance.mutate({
                vehicleId: maintenance!.id,
                endsAt: localInputToIso(ends),
                workshop: String(form.get("workshop") ?? ""),
                reason: String(form.get("reason") ?? ""),
              });
            }}
          >
            <p className="text-sm text-muted-foreground">
              {maintenance?.manufacturer} {maintenance?.model} — {maintenance?.plate}. Durante o
              período o veículo fica bloqueado para novas alocações.
            </p>
            <div className="space-y-2">
              <Label htmlFor="m-ends">Previsão de retorno</Label>
              <Input
                id="m-ends"
                name="ends_at"
                type="datetime-local"
                required
                defaultValue={isoToLocalInput(
                  new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-workshop">Oficina</Label>
              <Input id="m-workshop" name="workshop" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-reason">Motivo</Label>
              <Textarea id="m-reason" name="reason" rows={2} maxLength={400} />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="maint-form" disabled={startMaintenance.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(statusFor)} onOpenChange={(o) => !o && setStatusFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar status — {statusFor?.plate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="st-select">Status operacional</Label>
            <Select value={nextStatus} onValueChange={setNextStatus}>
              <SelectTrigger id="st-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["DISPONIVEL", "RESERVADO", "EM_VIAGEM", "EM_MANUTENCAO", "INDISPONIVEL"].map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {FLEET_STATUS_LABEL[s]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                statusFor && changeStatus.mutate({ id: statusFor.id, status: nextStatus })
              }
              disabled={changeStatus.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir veículo</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.plate} será removido definitivamente. Veículos com viagens, manutenções
              ou abastecimentos registrados não podem ser excluídos — nesse caso, desative o
              cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && remove.mutate(removing.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
