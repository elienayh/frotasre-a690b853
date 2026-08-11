import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles } from "@/hooks/useFleet";
import {
  logScheduleChange,
  useDayTrips,
  useDaySchedules,
  useDriverOptions,
  type DayTrip,
  type ScheduleWithData,
} from "@/hooks/useEscalas";
import { SCHEDULE_STATUS_LABEL, fmtLongDate, shiftDate, toDateInput } from "@/lib/escala";
import { fmtTime } from "@/lib/frota";
import { AppShell } from "@/components/AppShell";
import { AssignmentDialog } from "@/components/escala/AssignmentDialog";
import { ScheduleCard } from "@/components/escala/ScheduleCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/organizacao")({
  head: () => ({
    meta: [
      { title: "Organização do Dia — Frota SRE" },
      {
        name: "description",
        content:
          "Monte as escalas do dia: agrupe solicitações aprovadas por veículo e motorista, ajuste horários e resolva conflitos.",
      },
      { property: "og:title", content: "Organização do Dia — Frota SRE" },
      {
        property: "og:description",
        content: "Programação operacional diária da frota oficial da SRE.",
      },
    ],
  }),
  component: OrganizacaoDoDia,
});

function Indicator({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("font-display text-2xl font-bold", tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function OrganizacaoDoDia() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [driverFilter, setDriverFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [target, setTarget] = useState<{ schedule: ScheduleWithData; trip: DayTrip } | null>(null);

  const { data: schedules = [], isLoading } = useDaySchedules(date);
  const { data: trips = [] } = useDayTrips(date);
  const { data: vehicles = [] } = useVehicles(true);
  const { data: drivers = [] } = useDriverOptions();

  const isDriver = Boolean(profile?.is_sre_driver);
  const canOrganize = isAdmin || isDriver;

  function canEditSchedule(schedule: ScheduleWithData): boolean {
    if (isAdmin) return true;
    if (!isDriver || !user) return false;
    return (
      schedule.driver_user_id === user.id ||
      schedule.driver?.profile_id === user.id ||
      schedule.created_by === user.id
    );
  }

  const createSchedule = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("daily_schedules")
        .insert({ schedule_date: date, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await logScheduleChange({
        scheduleId: data.id,
        userId: user?.id ?? null,
        action: "Escala criada",
        field: "Data",
        newValue: fmtLongDate(date),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["daily-schedules"] });
      toast.success("Escala criada. Defina o veículo e o motorista.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const visibleSchedules = useMemo(
    () =>
      schedules.filter(
        (s) =>
          (driverFilter === "all" || s.driver_id === driverFilter) &&
          (vehicleFilter === "all" || s.vehicle_id === vehicleFilter) &&
          (statusFilter === "all" || s.status === statusFilter),
      ),
    [schedules, driverFilter, vehicleFilter, statusFilter],
  );

  const available = useMemo(
    () => trips.filter((t) => (pendingOnly ? t.scheduledCount === 0 : true)),
    [trips, pendingOnly],
  );

  const organized = trips.filter((t) => t.scheduledCount > 0).length;
  const pending = trips.length - organized;
  const myScheduleList = schedules.filter(canEditSchedule);

  return (
    <AppShell
      title="Organização do Dia"
      description="Agrupe as solicitações aprovadas em escalas de veículo e motorista."
      actions={
        canOrganize ? (
          <Button size="sm" onClick={() => createSchedule.mutate()}>
            <Plus className="mr-1 h-4 w-4" /> Nova escala
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="icon" aria-label="Dia anterior" onClick={() => setDate(shiftDate(date, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="font-display text-base font-semibold capitalize">{fmtLongDate(date)}</p>
          </div>
          <Button variant="outline" size="icon" aria-label="Próximo dia" onClick={() => setDate(shiftDate(date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            className="w-auto"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Selecionar data"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Indicator label="Aprovadas no dia" value={trips.length} />
          <Indicator label="Já organizadas" value={organized} tone="text-success" />
          <Indicator label="A organizar" value={pending} tone={pending ? "text-warning" : undefined} />
          <Indicator label="Escalas" value={schedules.length} />
          <Indicator
            label="Veículos utilizados"
            value={new Set(schedules.map((s) => s.vehicle_id).filter(Boolean)).size}
          />
          <Indicator
            label="Motoristas envolvidos"
            value={new Set(schedules.map((s) => s.driver_id).filter(Boolean)).size}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={driverFilter} onValueChange={setDriverFilter}>
            <SelectTrigger className="w-48" aria-label="Filtrar por motorista">
              <SelectValue placeholder="Motorista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motoristas</SelectItem>
              {drivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-48" aria-label="Filtrar por veículo">
              <SelectValue placeholder="Veículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os veículos</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.plate} — {v.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(SCHEDULE_STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={pendingOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setPendingOnly((v) => !v)}
          >
            Somente não organizadas
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section aria-label="Solicitações disponíveis" className="space-y-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Viagens / atendimentos disponíveis ({available.length})
            </h2>
            {available.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhuma solicitação aprovada pendente para esta data.
              </p>
            ) : (
              available.map((trip) => (
                <Card
                  key={trip.id}
                  draggable={canOrganize}
                  onDragStart={(e) =>
                    e.dataTransfer.setData("application/json", JSON.stringify(trip))
                  }
                  className={cn(
                    "cursor-grab active:cursor-grabbing",
                    trip.scheduledCount > 0 && "border-success/40",
                  )}
                >
                  <CardContent className="space-y-1 p-4 text-sm">
                    <p className="font-semibold">
                      {fmtTime(trip.departure_at)} · #{trip.code}
                    </p>
                    <p>{trip.destination_text}</p>
                    <p className="text-xs text-muted-foreground">
                      {trip.city_text ?? "—"} · {trip.requester_name ?? "—"} ·{" "}
                      {trip.passengers + trip.rides} passageiro(s)
                      {trip.rides ? ` (${trip.rides} carona)` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{trip.purpose}</p>
                    <p className="text-xs text-muted-foreground">
                      {trip.needs_sre_driver ? "Solicitou motorista da SRE" : "Condutor próprio"}
                      {trip.scheduledCount > 0
                        ? ` · ${trip.scheduledCount} atendimento(s) na escala`
                        : ""}
                    </p>
                    {canOrganize && myScheduleList.length ? (
                      <Select
                        onValueChange={(scheduleId) => {
                          const schedule = schedules.find((s) => s.id === scheduleId);
                          if (schedule) setTarget({ schedule, trip });
                        }}
                      >
                        <SelectTrigger className="mt-2" aria-label="Adicionar à escala">
                          <SelectValue placeholder="Adicionar à escala" />
                        </SelectTrigger>
                        <SelectContent>
                          {myScheduleList.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              Escala {String(s.code).padStart(2, "0")} —{" "}
                              {s.driver?.full_name ?? "sem motorista"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          <section aria-label="Escalas do dia" className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando escalas…</p>
            ) : visibleSchedules.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
                Nenhuma escala para esta data. Use “Nova escala” para começar.
              </p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {visibleSchedules.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    canEdit={canEditSchedule(schedule)}
                    onDropTrip={(trip, target_) => setTarget({ schedule: target_, trip })}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {target ? (
        <AssignmentDialog
          open={Boolean(target)}
          onOpenChange={(open) => !open && setTarget(null)}
          schedule={target.schedule}
          trip={target.trip}
        />
      ) : null}
    </AppShell>
  );
}
