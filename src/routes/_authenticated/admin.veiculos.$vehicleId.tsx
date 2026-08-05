import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtDateTime, fmtKm, fmtTime, dateTimeToIso, todayInput } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/admin/veiculos/$vehicleId")({
  component: FichaVeiculo,
});

function FichaVeiculo() {
  const { vehicleId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
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
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["vehicle-blocks", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_blocks")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("starts_at", { ascending: false });
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
        .limit(10);
      if (error) throw error;
      return data;
    },
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
      void queryClient.invalidateQueries({ queryKey: ["vehicle-fuel", vehicleId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title={vehicle ? `${vehicle.manufacturer} ${vehicle.model}` : "Veículo"}
      description={vehicle ? `Placa ${vehicle.plate}` : undefined}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do veículo</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Lugares</dt>
                  <dd>{vehicle?.capacity ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Ano</dt>
                  <dd>{vehicle?.year ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Combustível</dt>
                  <dd>{vehicle?.fuel ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Hodômetro</dt>
                  <dd>{fmtKm(vehicle?.odometer)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Patrimônio</dt>
                  <dd>{vehicle?.asset_number ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bloqueios e manutenções</CardTitle>
            </CardHeader>
            <CardContent>
              {blocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum bloqueio registrado.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {blocks.map((b) => (
                    <li key={b.id} className="rounded-md border border-border p-3">
                      <p className="font-medium">{b.block_type}</p>
                      <p className="text-muted-foreground">
                        {fmtDateTime(b.starts_at)} — {fmtDateTime(b.ends_at)}
                      </p>
                      {b.reason ? <p className="mt-1">{b.reason}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de viagens</CardTitle>
            </CardHeader>
            <CardContent>
              {trips.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem viagens registradas.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {trips.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2"
                    >
                      <span>
                        <span className="font-medium">{t.destination_text}</span>
                        <span className="block text-muted-foreground">
                          {fmtDate(t.departure_at)} · {fmtTime(t.departure_at)} —{" "}
                          {fmtTime(t.return_at)} · {t.requester_name ?? "—"}
                        </span>
                      </span>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <span className="sr-only">{dateTimeToIso(todayInput(), "00:00")}</span>
    </AppShell>
  );
}
