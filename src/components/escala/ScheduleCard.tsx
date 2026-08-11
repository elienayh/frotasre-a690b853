import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  History,
  Pencil,
  Play,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles } from "@/hooks/useFleet";
import {
  logScheduleChange,
  notifyUsers,
  useDriverOptions,
  type AssignmentWithTrip,
  type DayTrip,
  type ScheduleWithData,
} from "@/hooks/useEscalas";
import {
  ASSIGNMENT_STATUS_LABEL,
  SCHEDULE_STATUS,
  SCHEDULE_STATUS_LABEL,
  SEGMENT_LABEL,
  durationLabel,
  fmtLongDate,
  scheduleTone,
  type ScheduleStatus,
} from "@/lib/escala";
import { fmtTime } from "@/lib/frota";
import { AssignmentDialog } from "@/components/escala/AssignmentDialog";
import { ScheduleHistoryDialog } from "@/components/escala/ScheduleHistoryDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ScheduleCardProps {
  schedule: ScheduleWithData;
  /** Permite alterar a escala (DAFI ou motorista responsável). */
  canEdit: boolean;
  /** Solicitação recebida por arrastar e soltar. */
  onDropTrip?: ((trip: DayTrip, schedule: ScheduleWithData) => void) | undefined;
  compact?: boolean | undefined;
}

/** Ficha operacional de uma escala, com linha do tempo dos atendimentos. */
export function ScheduleCard({ schedule, canEdit, onDropTrip, compact }: ScheduleCardProps) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: vehicles = [] } = useVehicles(true);
  const { data: drivers = [] } = useDriverOptions();
  const [editing, setEditing] = useState<AssignmentWithTrip | null>(null);
  const [adding, setAdding] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["daily-schedules"] });
    void queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
    void queryClient.invalidateQueries({ queryKey: ["day-trips"] });
    void queryClient.invalidateQueries({ queryKey: ["schedule-history"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  const updateSchedule = useMutation({
    mutationFn: async (patch: {
      status?: ScheduleStatus;
      vehicle_id?: string | null;
      driver_id?: string | null;
      driver_user_id?: string | null;
      action: string;
      field: string;
      oldValue: string;
      newValue: string;
    }) => {
      const { action, field, oldValue, newValue, ...values } = patch;
      const { error } = await supabase.from("daily_schedules").update(values).eq("id", schedule.id);
      if (error) throw new Error(error.message);
      await logScheduleChange({
        scheduleId: schedule.id,
        userId: user?.id ?? null,
        action,
        field,
        oldValue,
        newValue,
      });
      if (patch.status === "PUBLICADA") {
        const requesters = schedule.assignments.map((a) => a.trip?.requester_id);
        await notifyUsers(
          [...requesters, schedule.driver_user_id, schedule.driver?.profile_id],
          "Programação publicada",
          `A programação de ${fmtLongDate(schedule.schedule_date)} foi publicada.`,
        );
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Escala atualizada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeAssignment = useMutation({
    mutationFn: async (assignment: AssignmentWithTrip) => {
      const { error } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("id", assignment.id);
      if (error) throw new Error(error.message);
      await logScheduleChange({
        scheduleId: schedule.id,
        userId: user?.id ?? null,
        action: "Atendimento removido da escala",
        field: "Trecho",
        oldValue: `${assignment.origin_text} → ${assignment.destination_text}`,
      });
      await notifyUsers(
        [assignment.trip?.requester_id],
        "Atendimento removido da programação",
        `Sua viagem foi retirada da programação de ${fmtLongDate(
          schedule.schedule_date,
        )} e voltou para a lista de solicitações a organizar.`,
        assignment.trip_id,
      );
    },
    onSuccess: () => {
      invalidate();
      toast.success("Atendimento removido. A solicitação voltou para a lista de disponíveis.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const move = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const list = [...schedule.assignments];
      const target = index + dir;
      if (target < 0 || target >= list.length) return;
      const a = list[index]!;
      const b = list[target]!;
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from("schedule_assignments").update({ order_index: b.order_index }).eq("id", a.id),
        supabase.from("schedule_assignments").update({ order_index: a.order_index }).eq("id", b.id),
      ]);
      if (e1 || e2) throw new Error(e1?.message ?? e2?.message ?? "Falha ao reordenar.");
      await logScheduleChange({
        scheduleId: schedule.id,
        assignmentId: a.id,
        userId: user?.id ?? null,
        action: "Ordem dos atendimentos alterada",
        field: "Ordem",
        oldValue: String(index + 1),
        newValue: String(target + 1),
      });
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const execute = useMutation({
    mutationFn: async ({
      assignment,
      mode,
    }: {
      assignment: AssignmentWithTrip;
      mode: "start" | "finish";
    }) => {
      const now = new Date().toISOString();
      const patch =
        mode === "start"
          ? { status: "EM_ANDAMENTO" as const, actual_departure: now }
          : { status: "CONCLUIDO" as const, actual_arrival: now };
      const { error } = await supabase
        .from("schedule_assignments")
        .update(patch)
        .eq("id", assignment.id);
      if (error) throw new Error(error.message);
      await logScheduleChange({
        scheduleId: schedule.id,
        assignmentId: assignment.id,
        userId: user?.id ?? null,
        action: mode === "start" ? "Atendimento iniciado" : "Atendimento concluído",
        field: "Horário real",
        newValue: fmtTime(now),
      });
      if (mode === "start" && schedule.status !== "EM_EXECUCAO") {
        await supabase
          .from("daily_schedules")
          .update({ status: "EM_EXECUCAO" })
          .eq("id", schedule.id);
      }
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const totalPassengers = schedule.assignments.reduce((max, a) => Math.max(max, a.passengers), 0);
  const capacity = schedule.vehicle?.capacity ?? 0;
  const overCapacity = capacity > 0 && totalPassengers > capacity;
  const missingSetup = !schedule.vehicle_id || !schedule.driver_id;

  return (
    <Card
      className={cn(
        "flex flex-col",
        dragOver && "ring-2 ring-primary",
        missingSetup && "border-warning/50",
      )}
      onDragOver={(e) => {
        if (!canEdit || !onDropTrip) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        if (!canEdit || !onDropTrip) return;
        e.preventDefault();
        const raw = e.dataTransfer.getData("application/json");
        if (!raw) return;
        try {
          onDropTrip(JSON.parse(raw) as DayTrip, schedule);
        } catch {
          toast.error("Não foi possível ler a solicitação arrastada.");
        }
      }}
    >
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold">
              Escala {String(schedule.code).padStart(2, "0")}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {schedule.driver?.full_name ?? "Sem motorista"} ·{" "}
              {schedule.vehicle
                ? `${schedule.vehicle.model} ${schedule.vehicle.plate}`
                : "Sem veículo"}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              scheduleTone(schedule.status),
            )}
          >
            {SCHEDULE_STATUS_LABEL[schedule.status]}
          </span>
        </div>

        {canEdit ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Select
              value={schedule.vehicle_id ?? ""}
              onValueChange={(value) =>
                updateSchedule.mutate({
                  vehicle_id: value,
                  action: "Veículo da escala alterado",
                  field: "Veículo",
                  oldValue: schedule.vehicle?.plate ?? "—",
                  newValue: vehicles.find((v) => v.id === value)?.plate ?? "—",
                })
              }
            >
              <SelectTrigger aria-label="Veículo">
                <SelectValue placeholder="Veículo" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate} — {v.model} ({v.capacity} lug.)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={schedule.driver_id ?? ""}
              onValueChange={(value) => {
                const driver = drivers.find((d) => d.id === value);
                updateSchedule.mutate({
                  driver_id: value,
                  driver_user_id: driver?.profile_id ?? null,
                  action: "Motorista da escala alterado",
                  field: "Motorista",
                  oldValue: schedule.driver?.full_name ?? "—",
                  newValue: driver?.full_name ?? "—",
                });
              }}
            >
              <SelectTrigger aria-label="Motorista">
                <SelectValue placeholder="Motorista" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={schedule.status}
              onValueChange={(value) =>
                updateSchedule.mutate({
                  status: value as ScheduleStatus,
                  action: "Status da escala alterado",
                  field: "Status",
                  oldValue: SCHEDULE_STATUS_LABEL[schedule.status],
                  newValue: SCHEDULE_STATUS_LABEL[value as ScheduleStatus],
                })
              }
            >
              <SelectTrigger aria-label="Status da escala">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_STATUS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {SCHEDULE_STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {overCapacity ? (
          <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Trecho com {totalPassengers} passageiros acima da capacidade ({capacity}).
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {schedule.assignments.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum atendimento. Arraste uma solicitação para cá ou use “Adicionar”.
          </p>
        ) : (
          <ol className="space-y-2">
            {schedule.assignments.map((assignment, index) => (
              <li
                key={assignment.id}
                className="rounded-md border border-border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {fmtTime(assignment.scheduled_departure)} → {fmtTime(assignment.scheduled_arrival)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({durationLabel(assignment.scheduled_departure, assignment.scheduled_arrival)})
                      </span>
                    </p>
                    <p className="truncate">
                      {assignment.origin_text} → {assignment.destination_text}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {SEGMENT_LABEL[assignment.segment_type]}
                      {assignment.trip ? ` · Solicitação #${assignment.trip.code}` : ""}
                      {assignment.requested_at
                        ? ` · Solicitado ${fmtTime(assignment.requested_at)}`
                        : ""}
                      {assignment.actual_departure
                        ? ` · Real ${fmtTime(assignment.actual_departure)}`
                        : ""}
                    </p>
                    {assignment.passengers_names ? (
                      <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                        <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                        {assignment.passengers_names} ({assignment.passengers})
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      scheduleTone(assignment.status),
                    )}
                  >
                    {ASSIGNMENT_STATUS_LABEL[assignment.status]}
                  </span>
                </div>

                {canEdit ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Mover para cima"
                      disabled={index === 0}
                      onClick={() => move.mutate({ index, dir: -1 })}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Mover para baixo"
                      disabled={index === schedule.assignments.length - 1}
                      onClick={() => move.mutate({ index, dir: 1 })}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(assignment)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                    {assignment.status !== "CONCLUIDO" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          execute.mutate({
                            assignment,
                            mode: assignment.status === "EM_ANDAMENTO" ? "finish" : "start",
                          })
                        }
                      >
                        {assignment.status === "EM_ANDAMENTO" ? (
                          <>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Concluir
                          </>
                        ) : (
                          <>
                            <Play className="mr-1 h-3.5 w-3.5" /> Iniciar
                          </>
                        )}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeAssignment.mutate(assignment)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Retirar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}

        {!compact ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {canEdit ? (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar atendimento
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
              <History className="mr-1 h-4 w-4" /> Histórico
            </Button>
            {isAdmin ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  const { error } = await supabase
                    .from("daily_schedules")
                    .delete()
                    .eq("id", schedule.id);
                  if (error) toast.error(error.message);
                  else {
                    invalidate();
                    toast.success("Escala excluída. As viagens voltaram para as disponíveis.");
                  }
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Excluir escala
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      {adding ? (
        <AssignmentDialog open={adding} onOpenChange={setAdding} schedule={schedule} />
      ) : null}
      {editing ? (
        <AssignmentDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          schedule={schedule}
          assignment={editing}
        />
      ) : null}
      <ScheduleHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        schedule={schedule}
      />
    </Card>
  );
}
