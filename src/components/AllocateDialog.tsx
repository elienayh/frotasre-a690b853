import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriverPicker } from "@/components/DriverPicker";
import { OccupantsList } from "@/components/OccupantsList";
import { StopDriverEditor } from "@/components/StopDriverEditor";
import { useAuth } from "@/hooks/useAuth";
import { usePeople } from "@/hooks/useFrotaOptions";
import { cn } from "@/lib/utils";
import {
  dateTimeToIso,
  friendlyDbError,
  fmtDate,
  fmtDateTime,
  TRIP_STATUS_LABEL,
  type TripRow,
} from "@/lib/frota";


export interface AllocateDialogProps {
  trip: TripRow | null;
  onClose: () => void;
}

/** Etapa "Definir Transporte": DAFI escolhe veículo, motorista e horário definitivo. */
export function AllocateDialog({ trip, onClose }: AllocateDialogProps) {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const [vehicleId, setVehicleId] = useState<string>("");
  const [driverUserId, setDriverUserId] = useState<string | null>(null);

  const pad = (n: number) => String(n).padStart(2, "0");
  const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const asTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const [date, setDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // Ao abrir outra viagem, recarrega a alocação já persistida (única fonte de verdade).
  useEffect(() => {
    if (!trip) return;
    setVehicleId(trip.vehicle_id ?? "");
    setDriverUserId(trip.assigned_driver_user_id ?? trip.requested_driver_id ?? null);
    const dep = new Date(trip.departure_at || "");
    const back = new Date(trip.return_at || "");
    setDate(asDate(dep));
    setReturnDate(asDate(back));
    setStart(asTime(dep));
    setEnd(asTime(back));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id]);

  const { data: people = [] } = usePeople();

  const effectiveDate = date;
  const effectiveReturnDate = returnDate || date;
  const effectiveStart = start || "08:00";
  const effectiveEnd = end || "17:00";

  const startIso = trip && effectiveDate ? dateTimeToIso(effectiveDate, effectiveStart) : "";
  const endIso =
    trip && effectiveReturnDate ? dateTimeToIso(effectiveReturnDate, effectiveEnd) : "";


  const { data: availability = [] } = useQuery({
    queryKey: ["fleet-availability", startIso, endIso, trip?.passengers],
    enabled: Boolean(trip && startIso && endIso && endIso > startIso),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fleet_availability", {
        p_start: startIso,
        p_end: endIso,
        p_passengers: trip!.passengers || 0,
      });
      if (error) throw error;
      return data;
    },
  });

  // Sugestão do solicitante e checagem de conflito de agenda do condutor escolhido.
  const requestedDriverId = trip?.requested_driver_id ?? null;
  const requestedDriverName = requestedDriverId
    ? (people.find((p) => p.id === requestedDriverId)?.full_name ?? null)
    : (trip?.suggested_driver ?? null);

  const { data: driverConflicts = [] } = useQuery({
    queryKey: ["driver-busy", driverUserId, startIso, endIso, trip?.id],
    enabled: Boolean(driverUserId && startIso && endIso && endIso > startIso),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("driver_user_busy", {
        _user_id: driverUserId!,
        _start: startIso,
        _end: endIso,
        ...(trip?.id ? { _exclude_trip: trip.id } : {}),
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Lotação: o motorista ocupa um lugar e é contado à parte dos ocupantes.
  const selectedVehicle = availability.find((v) => v.vehicle_id === vehicleId) ?? null;
  const occupants = trip?.passengers ?? 0;
  const driverSeats = driverUserId ? 1 : 0;
  const totalSeats = occupants + driverSeats;
  const capacity = selectedVehicle?.capacity ?? null;
  const overCapacity = capacity != null && totalSeats > capacity;
  const capacityBlocked = overCapacity && !isSuperAdmin;

  const approve = useMutation({
    mutationFn: async (notes: string) => {
      if (!vehicleId) throw new Error("Selecione o veículo.");
      if (capacityBlocked) {
        throw new Error(
          "Capacidade do veículo excedida: escolha outro veículo ou reduza os ocupantes.",
        );
      }

      const { error } = await supabase
        .from("trip_requests")
        .update({
          vehicle_id: vehicleId,
          assigned_driver_user_id: driverUserId,
          departure_at: startIso,
          return_at: endIso,
          admin_notes: notes || null,
          rejection_reason: null,
          status: "APROVADA",
        })
        .eq("id", trip!.id || "");
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Viagem aprovada e transporte definido.");
      void queryClient.invalidateQueries();
      void queryClient.invalidateQueries({ queryKey: ["admin-trips-all"] });

      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(trip)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Definir transporte</DialogTitle>
          <DialogDescription>
            {trip
              ? `#${trip.code} · ${trip.destination_text} · ${trip.passengers} ocupante(s)`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {trip ? (
          <section className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <h3 className="mb-2 font-display text-sm font-semibold">Ficha da solicitação</h3>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Field label="Solicitante" value={trip.requester_name ?? "—"} />
              <Field label="Situação" value={trip.status ? (TRIP_STATUS_LABEL[trip.status] ?? trip.status) : "PENDENTE"} />
              <Field label="Data da viagem" value={fmtDate(trip.departure_at)} />
              <Field label="Data de retorno" value={fmtDate(trip.return_at)} />
              <Field
                label="Aprovada por"
                value={
                  trip.approved_by
                    ? `${people.find((p) => p.id === trip.approved_by)?.full_name ?? "—"}${
                        trip.approved_at ? ` · ${fmtDateTime(trip.approved_at)}` : ""
                      }`
                    : "—"
                }
              />
              <Field
                label="Organizada por"
                value={
                  trip.organized_by
                    ? `${people.find((p) => p.id === trip.organized_by)?.full_name ?? "—"}${
                        trip.organized_at ? ` · ${fmtDateTime(trip.organized_at)}` : ""
                      }`
                    : "—"
                }
              />
            </dl>
            <p className="mt-2 text-muted-foreground">Motivo: {trip.purpose}</p>
          </section>
        ) : null}

        {trip ? (
          <div className="space-y-2">
            <Label>Destinos e motorista de cada trecho</Label>
            <StopDriverEditor tripId={trip.id || ""} onlySreDrivers={Boolean(trip.needs_sre_driver)} />
          </div>
        ) : null}

        {trip ? (
          <div className="space-y-2">
            <Label>Ocupantes</Label>
            <OccupantsList tripId={trip.id || ""} requesterId={trip.requester_id || ""} />
          </div>
        ) : null}

        <form
          id="allocate-form"
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            approve.mutate(String(form.get("admin_notes") ?? ""));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="al-date">Data da viagem</Label>
              <Input
                id="al-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="al-return-date">Data de retorno</Label>
              <Input
                id="al-return-date"
                type="date"
                value={effectiveReturnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="al-start">Saída</Label>
              <Input
                id="al-start"
                type="time"
                value={effectiveStart}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="al-end">Retorno</Label>
              <Input
                id="al-end"
                type="time"
                value={effectiveEnd}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>


          <div className="space-y-2">
            <Label>Veículos no período</Label>
            <ul className="grid gap-2">
              {availability.map((v) => {
                const selected = vehicleId === v.vehicle_id;
                return (
                  <li key={v.vehicle_id}>
                    <button
                      type="button"
                      disabled={!v.is_available}
                      onClick={() => setVehicleId(v.vehicle_id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left text-sm transition-colors",
                        selected ? "border-primary bg-primary/5" : "border-border",
                        !v.is_available && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <span>
                        <span className="font-medium">
                          {v.manufacturer} {v.model} — {v.plate}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {v.capacity} lugares
                          {v.detail ? ` · ${v.detail}` : ""}
                          {v.conflict_start
                            ? ` · ocupado ${fmtDateTime(v.conflict_start)} – ${fmtDateTime(v.conflict_end)}`
                            : ""}
                        </span>
                      </span>
                      <Badge variant={v.is_available ? "default" : "destructive"}>
                        {v.is_available ? "Disponível" : v.reason}
                      </Badge>
                    </button>
                  </li>
                );
              })}
              {availability.length === 0 ? (
                <li className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Informe data e horários válidos para calcular a disponibilidade.
                </li>
              ) : null}
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="al-driver">Condutor definido</Label>
            <DriverPicker
              id="al-driver"
              value={driverUserId}
              onChange={setDriverUserId}
              placeholder="Selecione o condutor"
              onlySreDrivers={Boolean(trip?.needs_sre_driver)}
            />
            {driverUserId ? (
              <p className="text-xs text-muted-foreground">
                Condutor definido: {people.find((p) => p.id === driverUserId)?.full_name ?? "—"}
              </p>
            ) : null}
            {requestedDriverName ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Indicado pelo solicitante: {requestedDriverName}</span>
                {requestedDriverId && requestedDriverId !== driverUserId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDriverUserId(requestedDriverId)}
                  >
                    Confirmar indicação
                  </Button>
                ) : null}
              </div>
            ) : null}
            {driverConflicts.length > 0 ? (
              <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                Atenção: este condutor também está na viagem #
                {driverConflicts[0]?.code} ({fmtDateTime(driverConflicts[0]?.departure_at)} –{" "}
                {fmtDateTime(driverConflicts[0]?.return_at)}). A alocação continua permitida —
                organize as etapas na Organização do Dia.
              </p>
            ) : null}
          </div>

          {capacity != null ? (
            <div
              className={cn(
                "rounded-md border p-3 text-xs",
                overCapacity
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <p className="font-medium">
                Lotação: capacidade {capacity} · motorista {driverSeats} · ocupantes {occupants} ·
                total {totalSeats}
              </p>
              {overCapacity ? (
                <p className="mt-1">
                  {isSuperAdmin
                    ? "Capacidade excedida — liberado apenas pela permissão de Super Admin."
                    : "Capacidade excedida: a confirmação deste veículo está bloqueada."}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="admin_notes">Observações ao solicitante</Label>
            <Textarea id="admin_notes" name="admin_notes" rows={2} maxLength={400} />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} type="button">
            Fechar
          </Button>
          <Button
            type="submit"
            form="allocate-form"
            disabled={approve.isPending || !vehicleId || capacityBlocked}
          >
            Aprovar viagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Par rótulo/valor da ficha de aprovação. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

