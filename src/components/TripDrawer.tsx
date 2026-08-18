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
            <div className="space-y-6 px-4 pb-8">
              {/* 1. Cidade e 2. Local */}
              <div className={cn("rounded-2xl border-l-4 p-4 shadow-sm", color.chip, color.border)}>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className={cn("h-4 w-4", color.text)} />
                  <p className={cn("font-display text-xl font-black uppercase tracking-tight", color.text)}>
                    {tripCity(trip)}
                  </p>
                </div>
                <p className="text-sm font-semibold opacity-90">{trip.destination_text}</p>
              </div>

              {/* 3. Data e Horário e 4. Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border border-border/40">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Partida e Retorno</p>
                  <p className="text-sm font-bold">
                    {fmtDate(trip.departure_at)} · {fmtTime(trip.departure_at)} – {fmtTime(trip.return_at)}
                  </p>
                </div>
                <StatusBadge status={trip.status} />
              </div>

              {/* 5. Veículo e 6. Motorista */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                    <Car className="h-3 w-3" /> Veículo
                  </Label>
                  <div className="rounded-xl border border-border/40 p-3 bg-background/50">
                    <p className="text-sm font-bold leading-tight">
                      {trip.vehicles ? `${trip.vehicles.manufacturer} ${trip.vehicles.model}` : "A definir"}
                    </p>
                    <p className="text-[10px] font-mono font-bold text-muted-foreground mt-1 tracking-tighter uppercase">
                      {trip.vehicles?.plate ?? "Sem placa"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> Motorista
                  </Label>
                  <div className="rounded-xl border border-border/40 p-3 bg-background/50">
                    <p className="text-sm font-bold leading-tight">{tripDriverName(trip)}</p>
                    <div className="mt-1">
                      {trip.needs_sre_driver ? (
                        <Badge variant="outline" className="text-[9px] h-4 font-black border-warning/30 text-warning bg-warning/5 px-1.5 uppercase tracking-tighter">
                          Motorista SRE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 font-black border-primary/20 text-primary bg-primary/5 px-1.5 uppercase tracking-tighter">
                          Motorista Próprio
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 13. Capacidade detalhada */}
              {trip.vehicles && (
                <div className="space-y-3 rounded-2xl border border-border/40 p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">Ocupação da Viagem</h3>
                    <Badge variant="outline" className="font-mono font-bold text-[10px] border-primary/20 text-primary px-2">
                      {trip.passengers + 1} / {trip.vehicles.capacity} lugares
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-background/40 border border-border/20">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Veículo</p>
                      <p className="text-lg font-black">{trip.vehicles.capacity}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-background/40 border border-border/20">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Motorista</p>
                      <p className="text-lg font-black text-primary">1</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-background/40 border border-border/20">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Ocupantes</p>
                      <p className="text-lg font-black text-primary">{trip.passengers}</p>
                    </div>
                  </div>
                  
                  <div className="pt-1">
                    <div className="flex justify-between text-[10px] font-bold mb-1 px-1">
                      <span className="text-muted-foreground">Ocupação Total</span>
                      <span>{Math.round(((trip.passengers + 1) / trip.vehicles.capacity) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${((trip.passengers + 1) / trip.vehicles.capacity) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 7. Ocupantes */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-black uppercase tracking-widest text-foreground">Lista de Ocupantes</h3>
                  {trip.requester?.sector && (
                    <Badge variant="outline" className={cn("text-[10px] font-black tracking-widest px-2 py-0.5", color.text, color.chip, color.border)}>
                      SETOR: {trip.requester.sector}
                    </Badge>
                  )}
                </div>
                <OccupantsList tripId={trip.id} requesterId={trip.requester_id} />
              </section>

              <Separator className="opacity-40" />

              {/* 8. Motivo e 9. Quilometragem */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Motivo da Viagem</Label>
                  <p className="text-sm font-medium leading-relaxed bg-muted/20 p-3 rounded-xl border border-border/40">
                    {trip.purpose}
                  </p>
                </div>



                <div className="space-y-3">
                  <h3 className="font-display text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
                    Controle de Quilometragem
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-xl border border-border/40">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">KM Saída</p>
                      <p className="text-sm font-mono font-bold">
                        {trip.odometer_start ? `${trip.odometer_start.toLocaleString()} km` : "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">KM Retorno</p>
                      <p className="text-sm font-mono font-bold">
                        {trip.odometer_end ? `${trip.odometer_end.toLocaleString()} km` : "—"}
                      </p>
                    </div>
                    {trip.odometer_start && trip.odometer_end && (
                      <div className="col-span-2 flex justify-between items-center pt-2 border-t border-border/40">
                        <span className="text-[10px] font-black text-primary uppercase">Percurso Total</span>
                        <span className="text-sm font-mono font-black text-primary">
                          {(trip.odometer_end - trip.odometer_start).toLocaleString()} km
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="opacity-40" />

              {/* 10. Informações administrativas */}
              <section className="space-y-4">
                <h3 className="font-display text-xs font-black uppercase tracking-[0.15em] text-foreground/80">Gestão e Auditoria</h3>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-[9px] font-bold text-muted-foreground uppercase">Solicitante</dt>
                    <dd className="text-sm font-bold">{trip.requester?.full_name ?? trip.requester_name ?? "—"}</dd>
                  </div>
                  {isAdmin && (
                    <>
                      <div className="space-y-1">
                        <dt className="text-[9px] font-bold text-muted-foreground uppercase">Aprovado por</dt>
                        <dd className="text-sm font-bold">
                          {trip.approver?.full_name ?? "—"}
                          {trip.approved_at && <span className="block text-[9px] font-medium opacity-60 font-mono mt-0.5">{fmtDate(trip.approved_at)}</span>}
                        </dd>
                      </div>
                      <div className="space-y-1">
                        <dt className="text-[9px] font-bold text-muted-foreground uppercase">Organizado por</dt>
                        <dd className="text-sm font-bold">
                          {trip.organizer?.full_name ?? "—"}
                          {trip.organized_at && <span className="block text-[9px] font-medium opacity-60 font-mono mt-0.5">{fmtDate(trip.organized_at)}</span>}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </section>

              <Separator className="opacity-40" />

              <section className="space-y-3">
                <h3 className="font-display text-xs font-black uppercase tracking-[0.15em] text-foreground/80">Histórico</h3>
                <AuditTimeline entityId={trip.id} entityType="trip" />
              </section>


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
        trip={trip ?? undefined}
        vehicle={trip?.vehicles ?? undefined}

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
