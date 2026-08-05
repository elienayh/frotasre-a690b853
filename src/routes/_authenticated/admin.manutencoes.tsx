import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateTimeToIso, fmtDateTime, friendlyDbError, todayInput } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/admin/manutencoes")({
  component: Manutencoes,
});

const BLOCK_TYPES = [
  { value: "MANUTENCAO", label: "Manutenção" },
  { value: "INDISPONIVEL", label: "Indisponível" },
] as const;

function Manutencoes() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [blockType, setBlockType] = useState<string>("MANUTENCAO");

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, manufacturer, model")
        .eq("is_active", true)
        .order("plate");
      if (error) throw error;
      return data;
    },
  });

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ["blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_blocks")
        .select("*, vehicles(plate, manufacturer, model)")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      if (!vehicleId) throw new Error("Selecione o veículo.");
      const startsAt = dateTimeToIso(
        String(form.get("start_date")),
        String(form.get("start_time") || "00:00"),
      );
      const endsAt = dateTimeToIso(
        String(form.get("end_date")),
        String(form.get("end_time") || "23:59"),
      );
      if (endsAt <= startsAt) throw new Error("O término deve ser posterior ao início.");
      const { error } = await supabase.from("vehicle_blocks").insert({
        vehicle_id: vehicleId,
        block_type: blockType as "MANUTENCAO" | "INDISPONIVEL",
        starts_at: startsAt,
        ends_at: endsAt,
        reason: String(form.get("reason") || "") || null,
        workshop: String(form.get("workshop") || "") || null,
      });
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Bloqueio registrado.");
      setOpen(false);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vehicle_blocks")
        .update({ is_open: false, finished_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Bloqueio encerrado.");
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Manutenções e Bloqueios"
      description="Períodos em que um veículo não pode ser alocado para viagens."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Novo bloqueio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar bloqueio</DialogTitle>
            </DialogHeader>
            <form
              id="block-form"
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="b-vehicle">Veículo</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger id="b-vehicle">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.manufacturer} {v.model} — {v.plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-type">Tipo</Label>
                <Select value={blockType} onValueChange={setBlockType}>
                  <SelectTrigger id="b-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCK_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="b-sd">Início</Label>
                  <Input id="b-sd" name="start_date" type="date" defaultValue={todayInput()} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-st">Hora</Label>
                  <Input id="b-st" name="start_time" type="time" defaultValue="08:00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-ed">Término</Label>
                  <Input id="b-ed" name="end_date" type="date" defaultValue={todayInput()} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-et">Hora</Label>
                  <Input id="b-et" name="end_time" type="time" defaultValue="18:00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-workshop">Oficina</Label>
                <Input id="b-workshop" name="workshop" maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-reason">Motivo</Label>
                <Textarea id="b-reason" name="reason" rows={2} maxLength={400} />
              </div>
            </form>
            <DialogFooter>
              <Button type="submit" form="block-form" disabled={create.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhum bloqueio registrado.
        </p>
      ) : (
        <ul className="grid gap-3">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium">
                  {b.vehicles
                    ? `${b.vehicles.manufacturer} ${b.vehicles.model} — ${b.vehicles.plate}`
                    : "Veículo"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {fmtDateTime(b.starts_at)} — {fmtDateTime(b.ends_at)}
                  {b.workshop ? ` · ${b.workshop}` : ""}
                </p>
                {b.reason ? <p className="text-sm">{b.reason}</p> : null}
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={b.is_open ? "destructive" : "secondary"}>
                  {b.is_open ? "Em aberto" : "Encerrado"}
                </Badge>
                {b.is_open ? (
                  <Button size="sm" variant="outline" onClick={() => close.mutate(b.id)}>
                    Encerrar
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
