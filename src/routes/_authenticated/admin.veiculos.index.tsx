import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fmtKm } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/admin/veiculos/")({
  component: Veiculos,
});

const vehicleSchema = z.object({
  plate: z.string().trim().min(6, { message: "Placa inválida" }).max(10),
  manufacturer: z.string().trim().min(2, { message: "Informe a marca" }).max(60),
  model: z.string().trim().min(1, { message: "Informe o modelo" }).max(60),
  capacity: z.coerce.number().int().min(1).max(60),
  year: z.coerce.number().int().min(1980).max(2100).optional(),
  fuel: z.string().trim().max(30).optional(),
  asset_number: z.string().trim().max(30).optional(),
  odometer: z.coerce.number().int().min(0).max(2_000_000),
});

function Veiculos() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: fleet = [], isLoading } = useQuery({
    queryKey: ["fleet-now"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fleet_now");
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, odometer, asset_number, is_active")
        .order("plate");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (payload: z.infer<typeof vehicleSchema>) => {
      const { error } = await supabase.from("vehicles").insert({
        plate: payload.plate.toUpperCase(),
        manufacturer: payload.manufacturer,
        model: payload.model,
        capacity: payload.capacity,
        year: payload.year ?? null,
        fuel: payload.fuel ?? null,
        asset_number: payload.asset_number ?? null,
        odometer: payload.odometer,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Veículo cadastrado.");
      setOpen(false);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Veículos"
      description="Frota oficial, status atual e dados de cada veículo."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Novo veículo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar veículo</DialogTitle>
            </DialogHeader>
            <form
              id="vehicle-form"
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const parsed = vehicleSchema.safeParse({
                  plate: form.get("plate"),
                  manufacturer: form.get("manufacturer"),
                  model: form.get("model"),
                  capacity: form.get("capacity"),
                  year: form.get("year") || undefined,
                  fuel: form.get("fuel") || undefined,
                  asset_number: form.get("asset_number") || undefined,
                  odometer: form.get("odometer") || 0,
                });
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
                  return;
                }
                create.mutate(parsed.data);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="v-plate">Placa</Label>
                <Input id="v-plate" name="plate" required maxLength={10} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-asset">Nº patrimônio</Label>
                <Input id="v-asset" name="asset_number" maxLength={30} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-manufacturer">Marca</Label>
                <Input id="v-manufacturer" name="manufacturer" required maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-model">Modelo</Label>
                <Input id="v-model" name="model" required maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-capacity">Lugares</Label>
                <Input id="v-capacity" name="capacity" type="number" min={1} defaultValue={5} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-year">Ano</Label>
                <Input id="v-year" name="year" type="number" min={1980} max={2100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-fuel">Combustível</Label>
                <Input id="v-fuel" name="fuel" maxLength={30} placeholder="Flex, Diesel…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-odometer">Hodômetro (km)</Label>
                <Input id="v-odometer" name="odometer" type="number" min={0} defaultValue={0} />
              </div>
            </form>
            <DialogFooter>
              <Button type="submit" form="vehicle-form" disabled={create.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fleet.map((v) => {
            const extra = vehicles.find((x) => x.id === v.vehicle_id);
            return (
              <li key={v.vehicle_id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-base font-semibold">
                      {v.manufacturer} {v.model}
                    </p>
                    <p className="text-sm text-muted-foreground">{v.plate}</p>
                  </div>
                  <StatusBadge status={v.status} kind="fleet" />
                </div>
                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Lugares</dt>
                    <dd>{v.capacity}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Hodômetro</dt>
                    <dd>{fmtKm(extra?.odometer)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Patrimônio</dt>
                    <dd>{extra?.asset_number ?? "—"}</dd>
                  </div>
                </dl>
                <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                  <Link to="/admin/veiculos/$vehicleId" params={{ vehicleId: v.vehicle_id }}>
                    Abrir ficha
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
