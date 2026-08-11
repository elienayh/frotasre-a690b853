import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlaces } from "@/hooks/useFrotaOptions";
import {
  findConflicts,
  logScheduleChange,
  notifyUsers,
  suggestFreeSlot,
  type AssignmentWithTrip,
  type ConflictRow,
  type DayTrip,
  type ScheduleWithData,
} from "@/hooks/useEscalas";
import {
  SEGMENT_LABEL,
  SEGMENT_TYPES,
  dayTimeToIso,
  fmtLongDate,
  toTimeInput,
  type SegmentType,
} from "@/lib/escala";
import { fmtTime } from "@/lib/frota";
import { Button } from "@/components/ui/button";
import { ComboBox } from "@/components/ComboBox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleWithData;
  /** Atendimento em edição; ausente quando é uma inclusão. */
  assignment?: AssignmentWithTrip | null;
  /** Solicitação de origem, ao incluir a partir da lista de disponíveis. */
  trip?: DayTrip | null;
}

interface FormState {
  segment: SegmentType;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  passengers: string;
  names: string;
  notes: string;
}

function initialState(
  assignment: AssignmentWithTrip | null | undefined,
  trip: DayTrip | null | undefined,
): FormState {
  if (assignment) {
    return {
      segment: assignment.segment_type,
      origin: assignment.origin_text,
      destination: assignment.destination_text,
      departure: toTimeInput(assignment.scheduled_departure),
      arrival: toTimeInput(assignment.scheduled_arrival),
      passengers: String(assignment.passengers),
      names: assignment.passengers_names ?? "",
      notes: assignment.notes ?? "",
    };
  }
  const passengers = (trip?.passengers ?? 1) + (trip?.rides ?? 0);
  const names = [trip?.occupants_names ?? "", ...(trip?.ridePeople ?? []).map((p) => `${p} (carona)`)]
    .filter(Boolean)
    .join(", ");
  return {
    segment: "LEVAR",
    origin: "SRE",
    destination: trip?.destination_text ?? "",
    departure: toTimeInput(trip?.departure_at),
    arrival: toTimeInput(trip?.return_at) || toTimeInput(trip?.departure_at),
    passengers: String(passengers || 1),
    names,
    notes: "",
  };
}

/** Inclusão e edição de um atendimento da escala, com verificação de conflitos. */
export function AssignmentDialog({
  open,
  onOpenChange,
  schedule,
  assignment,
  trip,
}: AssignmentDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: places = [] } = usePlaces();
  const [form, setForm] = useState<FormState>(() => initialState(assignment, trip));
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialState(assignment, trip));
      setConflicts([]);
      setSuggestion(null);
    }
  }, [open, assignment, trip]);

  const placeOptions = useMemo(
    () =>
      [{ value: "__sre__", label: "SRE (sede)" }].concat(
        places.map((p) => ({
          value: p.id,
          label: p.name,
          hint: p.city ?? undefined,
        })),
      ),
    [places],
  );

  const startIso = form.departure ? dayTimeToIso(schedule.schedule_date, form.departure) : "";
  const endIso = form.arrival ? dayTimeToIso(schedule.schedule_date, form.arrival) : "";
  const validRange = Boolean(startIso && endIso && endIso > startIso);

  const capacity = schedule.vehicle?.capacity ?? 0;
  const overCapacity = capacity > 0 && Number(form.passengers) > capacity;

  async function checkConflicts() {
    if (!validRange) {
      toast.error("Informe um horário de saída anterior ao de chegada.");
      return;
    }
    const rows = await findConflicts({
      vehicleId: schedule.vehicle_id,
      driverId: schedule.driver_id,
      driverUserId: schedule.driver_user_id,
      start: startIso,
      end: endIso,
      excludeAssignment: assignment?.id ?? null,
    });
    setConflicts(rows);
    if (!rows.length) {
      setSuggestion(null);
      toast.success("Nenhum conflito neste intervalo.");
      return;
    }
    const slot = await suggestFreeSlot({
      vehicleId: schedule.vehicle_id,
      driverId: schedule.driver_id,
      driverUserId: schedule.driver_user_id,
      start: startIso,
      end: endIso,
      excludeAssignment: assignment?.id ?? null,
    });
    setSuggestion(slot);
  }

  function applySuggestion() {
    if (!suggestion) return;
    const durationMs = +new Date(endIso) - +new Date(startIso);
    const newStart = new Date(suggestion);
    const newEnd = new Date(+newStart + durationMs);
    setForm((prev) => ({
      ...prev,
      departure: toTimeInput(newStart.toISOString()),
      arrival: toTimeInput(newEnd.toISOString()),
    }));
    setConflicts([]);
    setSuggestion(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!validRange) throw new Error("Informe um horário de saída anterior ao de chegada.");
      if (!form.destination.trim()) throw new Error("Informe o destino do atendimento.");

      const payload = {
        segment_type: form.segment,
        origin_text: form.origin.trim() || "SRE",
        destination_text: form.destination.trim(),
        scheduled_departure: startIso,
        scheduled_arrival: endIso,
        passengers: Number(form.passengers) || 0,
        passengers_names: form.names.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (assignment) {
        const { error } = await supabase
          .from("schedule_assignments")
          .update(payload)
          .eq("id", assignment.id);
        if (error) throw new Error(error.message);

        if (assignment.scheduled_departure !== startIso) {
          await logScheduleChange({
            scheduleId: schedule.id,
            assignmentId: assignment.id,
            userId: user?.id ?? null,
            action: "Horário do atendimento alterado",
            field: "Horário programado",
            oldValue: fmtTime(assignment.scheduled_departure),
            newValue: fmtTime(startIso),
          });
          await notifyUsers(
            [assignment.trip?.requester_id],
            "Seu atendimento foi reorganizado",
            `Dia ${fmtLongDate(schedule.schedule_date)}. Horário anterior: ${fmtTime(
              assignment.scheduled_departure,
            )}. Novo horário: ${fmtTime(startIso)}.`,
            assignment.trip_id,
          );
        } else {
          await logScheduleChange({
            scheduleId: schedule.id,
            assignmentId: assignment.id,
            userId: user?.id ?? null,
            action: "Atendimento atualizado",
            field: "Trecho",
            oldValue: `${assignment.origin_text} → ${assignment.destination_text}`,
            newValue: `${payload.origin_text} → ${payload.destination_text}`,
          });
        }
        return;
      }

      const nextOrder =
        schedule.assignments.reduce((max, a) => Math.max(max, a.order_index), 0) + 1;
      const { data, error } = await supabase
        .from("schedule_assignments")
        .insert({
          ...payload,
          schedule_id: schedule.id,
          trip_id: trip?.id ?? null,
          order_index: nextOrder,
          requested_at: trip?.departure_at ?? null,
          created_by: user?.id ?? null,
          status: "PROGRAMADO",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await logScheduleChange({
        scheduleId: schedule.id,
        assignmentId: data.id,
        userId: user?.id ?? null,
        action: "Atendimento adicionado à escala",
        field: "Trecho",
        newValue: `${payload.origin_text} → ${payload.destination_text} às ${fmtTime(startIso)}`,
      });
      await notifyUsers(
        [trip?.requester_id, schedule.driver_user_id, schedule.driver?.profile_id],
        "Programação do dia atualizada",
        `Sua viagem foi incluída na programação de ${fmtLongDate(
          schedule.schedule_date,
        )} com saída às ${fmtTime(startIso)}.`,
        trip?.id ?? null,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["daily-schedules"] });
      void queryClient.invalidateQueries({ queryKey: ["daily-schedule"] });
      void queryClient.invalidateQueries({ queryKey: ["day-trips"] });
      void queryClient.invalidateQueries({ queryKey: ["schedule-history"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(assignment ? "Atendimento atualizado." : "Atendimento adicionado à escala.");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assignment ? "Editar atendimento" : "Adicionar atendimento"}</DialogTitle>
          <DialogDescription>
            {trip ? `Solicitação #${trip.code} — ${trip.purpose}` : null}
            {assignment?.trip ? `Solicitação #${assignment.trip.code}` : null}
            {!trip && !assignment?.trip ? "Etapa operacional sem solicitação vinculada." : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="segment">Tipo de etapa</Label>
            <Select
              value={form.segment}
              onValueChange={(value) => setForm((p) => ({ ...p, segment: value as SegmentType }))}
            >
              <SelectTrigger id="segment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SEGMENT_LABEL[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="passengers">Passageiros</Label>
            <Input
              id="passengers"
              type="number"
              min={0}
              value={form.passengers}
              onChange={(e) => setForm((p) => ({ ...p, passengers: e.target.value }))}
            />
            {overCapacity ? (
              <p className="text-xs text-destructive">
                Acima da capacidade do veículo ({capacity} lugares).
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="origin">Origem</Label>
            <ComboBox
              id="origin"
              options={placeOptions}
              value={null}
              customLabel={form.origin}
              placeholder="Origem"
              onSelect={(option) =>
                setForm((p) => ({
                  ...p,
                  origin: option.value === "__sre__" ? "SRE" : option.label,
                }))
              }
              onCustom={(text) => setForm((p) => ({ ...p, origin: text }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destino</Label>
            <ComboBox
              id="destination"
              options={placeOptions}
              value={null}
              customLabel={form.destination}
              placeholder="Destino"
              onSelect={(option) =>
                setForm((p) => ({
                  ...p,
                  destination: option.value === "__sre__" ? "SRE" : option.label,
                }))
              }
              onCustom={(text) => setForm((p) => ({ ...p, destination: text }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="departure">Saída programada</Label>
            <Input
              id="departure"
              type="time"
              value={form.departure}
              onChange={(e) => setForm((p) => ({ ...p, departure: e.target.value }))}
            />
            {trip ? (
              <p className="text-xs text-muted-foreground">
                Horário solicitado: {fmtTime(trip.departure_at)} (previsibilidade)
              </p>
            ) : null}
            {assignment?.requested_at ? (
              <p className="text-xs text-muted-foreground">
                Horário solicitado: {fmtTime(assignment.requested_at)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="arrival">Chegada prevista</Label>
            <Input
              id="arrival"
              type="time"
              value={form.arrival}
              onChange={(e) => setForm((p) => ({ ...p, arrival: e.target.value }))}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="names">Passageiros do trecho</Label>
            <Textarea
              id="names"
              rows={2}
              value={form.names}
              onChange={(e) => setForm((p) => ({ ...p, names: e.target.value }))}
              placeholder="João, Maria, Ana (carona)"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>

        {conflicts.length ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Conflito detectado
            </p>
            <ul className="mt-2 space-y-1 text-destructive/90">
              {conflicts.map((c) => (
                <li key={c.assignment_id}>
                  {c.kind === "VEICULO" ? "Veículo" : "Motorista"} ocupado na escala {c.schedule_code}:{" "}
                  {c.label} — {fmtTime(c.starts_at)} às {fmtTime(c.ends_at)}
                </li>
              ))}
            </ul>
            {suggestion ? (
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={applySuggestion}>
                <Clock className="mr-2 h-4 w-4" aria-hidden="true" />
                Usar {fmtTime(suggestion)}
              </Button>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => void checkConflicts()}>
            Verificar conflitos
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {assignment ? "Salvar alterações" : "Adicionar à escala"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
