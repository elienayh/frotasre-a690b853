import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, MapPin, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAgendaTrip, tripCity, tripDriverName } from "@/hooks/useAgenda";
import { AllocateDialog } from "@/components/AllocateDialog";
import { TripMileageDialog } from "@/components/TripMileageDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { OccupantsList } from "@/components/OccupantsList";
import { AuditTimeline } from "@/components/AuditTimeline";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDate, fmtTime, friendlyDbError, type TripRow } from "@/lib/frota";
import { sectorColor } from "@/lib/setores";
import { cn } from "@/lib/utils";

export interface TripDrawerProps {
  tripId: string | null;
  onClose: () => void;
}

/** Painel lateral com os detalhes da viagem, carona e ações administrativas. */
export function TripDrawer({ tripId, onClose }: TripDrawerProps) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: trip, isLoading } = useAgendaTrip(tripId);
  const [askingRide, setAskingRide] = useState(false);
  const [allocating, setAllocating] = useState<TripRow | null>(null);
  const [mileageMode, setMileageMode] = useState<"start" | "end">("start");
  const [mileageOpen, setMileageOpen] = useState(false);

  const { data: rides = [] } = useQuery({
    queryKey: ["trip-rides", tripId],
    enabled: Boolean(tripId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ride_requests")
        .select("id, seats, reason, status, requester_id, profiles(full_name)")
        .eq("trip_id", tripId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => void queryClient.invalidateQueries();

  const askRide = useMutation({
    mutationFn: async ({ seats, reason }: { seats: number; reason: string }) => {
      const { error } = await supabase.from("ride_requests").insert({
        trip_id: tripId!,
        requester_id: user!.id,
        seats,
        reason: reason || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Pedido de carona enviado à DAFI.");
      setAskingRide(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async (status: "CONCLUIDA" | "CANCELADA" | "EM_ANDAMENTO") => {
      const { error } = await supabase
        .from("trip_requests")
        .update({ status })
        .eq("id", tripId!);
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Viagem atualizada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideRide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APROVADA" | "REJEITADA" }) => {
      const { error } = await supabase.from("ride_requests").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const alreadyAsked = rides.some((r) => r.requester_id === user?.id);
  const color = sectorColor(trip?.requester?.sector);

  return (
    <>
      <Sheet open={Boolean(tripId)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="pr-6 text-left">
              {isLoading || !trip ? "Carregando…" : `Viagem #${trip.code}`}
            </SheetTitle>
          </SheetHeader>

          {trip ? (
            <div className="space-y-5 px-4 pb-8">
              <div className={cn("rounded-lg border-l-4 p-3", color.chip, color.border)}>
                <p className="font-display text-lg font-semibold">{tripCity(trip)}</p>
                <p className="text-sm text-muted-foreground">{trip.destination_text}</p>
                <p className="mt-2 text-sm font-medium">
                  {fmtDate(trip.departure_at)} · {fmtTime(trip.departure_at)} –{" "}
                  {fmtTime(trip.return_at)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={trip.status} />
                {trip.requester?.sector ? (
                  <Badge variant="outline" className={color.text}>
                    {trip.requester.sector}
                  </Badge>
                ) : null}
                {trip.needs_sre_driver ? (
                  <Badge variant="outline" className="border-warning/40 text-warning">
                    Necessita motorista da SRE
                  </Badge>
                ) : (
                  <Badge variant="outline">Motorista próprio</Badge>
                )}
              </div>

              <dl className="space-y-2 text-sm">
                <Field label="Motivo" value={trip.purpose} />
                <Field
                  label="Solicitante"
                  value={trip.requester?.full_name ?? trip.requester_name ?? "—"}
                />
                <Field
                  label="Veículo"
                  value={
                    trip.vehicles
                      ? `${trip.vehicles.manufacturer} ${trip.vehicles.model}`
                      : "A definir"
                  }
                  icon={<Car className="h-4 w-4" />}
                />
                <Field label="Placa" value={trip.vehicles?.plate ?? "—"} />
                <Field label="Motorista" value={tripDriverName(trip)} />
                <Field
                  label="Ocupantes"
                  value={`${trip.passengers}${trip.vehicles ? ` de ${trip.vehicles.capacity}` : ""}`}
                  icon={<Users className="h-4 w-4" />}
                />
                {null}

                {trip.requester_notes ? (
                  <Field label="Observações do solicitante" value={trip.requester_notes} />
                ) : null}
                {trip.admin_notes ? (
                  <Field label="Observações da DAFI" value={trip.admin_notes} />
                ) : null}
              </dl>

              <Separator />

              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold">Ocupantes</h3>
                <OccupantsList tripId={trip.id} requesterId={trip.requester_id} />
                <Separator />
                <section className="space-y-2">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Controle de Quilometragem</h3>
                  <dl className="space-y-2 text-sm">
                    <Field 
                      label="KM Saída" 
                      value={trip.odometer_start ? `${trip.odometer_start.toLocaleString()} km` : "—"} 
                    />
                    <Field 
                      label="KM Retorno" 
                      value={trip.odometer_end ? `${trip.odometer_end.toLocaleString()} km` : "—"} 
                    />
                    {trip.odometer_start && trip.odometer_end && (
                      <div className="flex justify-between gap-4 border-t border-border/50 pt-2 font-bold text-primary">
                        <dt>Percurso Total</dt>
                        <dd>{(trip.odometer_end - trip.odometer_start).toLocaleString()} km</dd>
                      </div>
                    )}
                  </dl>
                </section>
              </section>

              <Separator />


              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold">Responsabilidade</h3>
                <dl className="space-y-2 text-sm">
                  <Field
                    label="Solicitante"
                    value={trip.requester?.full_name ?? trip.requester_name ?? "—"}
                  />
                  {isAdmin ? (
                    <>
                      <Field
                        label="Aprovado por"
                        value={
                          trip.approver?.full_name
                            ? `${trip.approver.full_name}${trip.approved_at ? ` · ${fmtDate(trip.approved_at)} ${fmtTime(trip.approved_at)}` : ""}`
                            : "—"
                        }
                      />
                      <Field
                        label="Organizado por"
                        value={
                          trip.organizer?.full_name
                            ? `${trip.organizer.full_name}${trip.organized_at ? ` · ${fmtDate(trip.organized_at)} ${fmtTime(trip.organized_at)}` : ""}`
                            : "—"
                        }
                      />
                    </>
                  ) : null}
                  <Field label="Motorista" value={tripDriverName(trip)} />
                  <Field
                    label="Veículo"
                    value={
                      trip.vehicles
                        ? `${trip.vehicles.manufacturer} ${trip.vehicles.model} — ${trip.vehicles.plate}`
                        : "A definir"
                    }
                  />
                </dl>
              </section>

              <Separator />

              <section className="space-y-2">
                <h3 className="font-display text-sm font-semibold">Histórico de Alterações</h3>
                <AuditTimeline entityId={trip.id} entityType="trip" />
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="font-display text-sm font-semibold">Pedidos de carona</h3>
                {rides.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pedido registrado.</p>
                ) : (
                  <ul className="space-y-2">
                    {rides.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-md border border-border p-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {r.profiles?.full_name ?? "Servidor"} · {r.seats} vaga(s)
                          </span>
                          <StatusBadge status={r.status} kind="trip" />
                        </div>
                        {r.reason ? (
                          <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                        ) : null}
                        {isAdmin && r.status === "PENDENTE" ? (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                decideRide.mutate({ id: r.id, status: "APROVADA" })
                              }
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                decideRide.mutate({ id: r.id, status: "REJEITADA" })
                              }
                            >
                              Recusar
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {!isAdmin || trip.requester_id !== user?.id ? null : null}

                {trip.allows_rides &&
                trip.requester_id !== user?.id &&
                !alreadyAsked &&
                ["APROVADA", "PROGRAMADA"].includes(trip.status) ? (
                  askingRide ? (
                    <form
                      className="space-y-3 rounded-md border border-border p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        askRide.mutate({
                          seats: Number(form.get("seats") ?? 1) || 1,
                          reason: String(form.get("reason") ?? ""),
                        });
                      }}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="ride-seats">Vagas necessárias</Label>
                        <Input
                          id="ride-seats"
                          name="seats"
                          type="number"
                          min={1}
                          max={10}
                          defaultValue={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ride-reason">Motivo</Label>
                        <Textarea id="ride-reason" name="reason" rows={2} maxLength={300} />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={askRide.isPending}>
                          Enviar pedido
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setAskingRide(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setAskingRide(true)}>
                      <MapPin className="mr-1 h-4 w-4" /> Solicitar carona
                    </Button>
                  )
                ) : null}
              </section>

              {isAdmin ? (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="font-display text-sm font-semibold">Ações da DAFI</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAllocating(trip as unknown as TripRow)}
                      >
                        Editar transporte
                      </Button>
                      
                      {trip.status === "APROVADA" || trip.status === "PROGRAMADA" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-info text-info hover:bg-info/10"
                          onClick={() => {
                            setMileageMode("start");
                            setMileageOpen(true);
                          }}
                        >
                          Iniciar Viagem
                        </Button>
                      ) : null}

                      {trip.status === "EM_ANDAMENTO" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-success text-success hover:bg-success/10"
                          onClick={() => {
                            setMileageMode("end");
                            setMileageOpen(true);
                          }}
                        >
                          Finalizar
                        </Button>
                      ) : null}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="col-span-2 text-destructive hover:bg-destructive/10"
                        onClick={() => changeStatus.mutate("CANCELADA")}
                      >
                        Cancelar viagem
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ao cancelar, o veículo é liberado imediatamente na agenda.
                    </p>
                  </section>
                </>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AllocateDialog trip={allocating} onClose={() => setAllocating(null)} />
      <TripMileageDialog
        trip={trip}
        vehicle={trip.vehicles}
        isOpen={mileageOpen}
        onOpenChange={setMileageOpen}
        mode={mileageMode}
        onSuccess={invalidate}
      />
    </>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
