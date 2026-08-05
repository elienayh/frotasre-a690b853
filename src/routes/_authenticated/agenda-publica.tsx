import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtDate, fmtTime } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/agenda-publica")({
  component: AgendaPublica,
});

function AgendaPublica() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rideTrip, setRideTrip] = useState<string | null>(null);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["scheduled-trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(
          "id, code, destination_text, departure_at, return_at, status, passengers, allows_rides, requester_name, vehicles(plate, manufacturer, model, capacity)",
        )
        .in("status", ["APROVADA", "PROGRAMADA", "EM_ANDAMENTO"])
        .gte("return_at", new Date().toISOString())
        .order("departure_at");
      if (error) throw error;
      return data;
    },
  });

  const askRide = useMutation({
    mutationFn: async ({ tripId, seats, note }: { tripId: string; seats: number; note: string }) => {
      const { error } = await supabase.from("ride_requests").insert({
        trip_id: tripId,
        requester_id: user!.id,
        seats,
        reason: note || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Pedido de carona enviado ao DAFI.");
      setRideTrip(null);
      void queryClient.invalidateQueries({ queryKey: ["scheduled-trips"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Viagens Programadas"
      description="Consulte os deslocamentos já aprovados e solicite carona quando houver vagas."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : trips.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma viagem programada no momento.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {trips.map((t) => (
            <li key={t.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold">{t.destination_text}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmtDate(t.departure_at)} · {fmtTime(t.departure_at)} —{" "}
                    {fmtTime(t.return_at)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Veículo</dt>
                  <dd>
                    {t.vehicles
                      ? `${t.vehicles.manufacturer} ${t.vehicles.model} — ${t.vehicles.plate}`
                      : "A definir"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Responsável</dt>
                  <dd>{t.requester_name ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Ocupantes previstos</dt>
                  <dd>
                    {t.passengers}
                    {t.vehicles?.capacity ? ` de ${t.vehicles.capacity}` : ""}
                  </dd>
                </div>
              </dl>
              {t.allows_rides ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setRideTrip(t.id)}
                >
                  Solicitar carona
                </Button>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">Viagem sem caronas disponíveis.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(rideTrip)} onOpenChange={(open) => !open && setRideTrip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar carona</DialogTitle>
            <DialogDescription>
              O DAFI avaliará a lotação do veículo antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          <form
            id="ride-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              askRide.mutate({
                tripId: rideTrip!,
                seats: Number(form.get("seats") ?? 1),
                note: String(form.get("note") ?? ""),
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="seats">Lugares necessários</Label>
              <Input id="seats" name="seats" type="number" min={1} max={10} defaultValue={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Justificativa</Label>
              <Input id="note" name="note" maxLength={200} placeholder="Motivo do deslocamento" />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="ride-form" disabled={askRide.isPending}>
              Enviar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
