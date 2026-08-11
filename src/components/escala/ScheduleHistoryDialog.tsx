import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useScheduleHistory,
  useScheduleIncidents,
  type ScheduleWithData,
} from "@/hooks/useEscalas";
import { INCIDENT_KINDS, INCIDENT_LABEL, fmtLongDate } from "@/lib/escala";
import { fmtDateTime } from "@/lib/frota";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export interface ScheduleHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleWithData;
}

/** Histórico cronológico e ocorrências operacionais da escala. */
export function ScheduleHistoryDialog({
  open,
  onOpenChange,
  schedule,
}: ScheduleHistoryDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: history = [] } = useScheduleHistory(open ? schedule.id : null);
  const { data: incidents = [] } = useScheduleIncidents(open ? schedule.id : null);
  const [kind, setKind] = useState<string>("ATRASO");
  const [description, setDescription] = useState("");

  async function saveIncident() {
    if (!description.trim()) {
      toast.error("Descreva a ocorrência.");
      return;
    }
    const { error } = await supabase.from("schedule_incidents").insert({
      schedule_id: schedule.id,
      user_id: user?.id ?? null,
      kind,
      description: description.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDescription("");
    void queryClient.invalidateQueries({ queryKey: ["schedule-incidents"] });
    toast.success("Ocorrência registrada.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escala {String(schedule.code).padStart(2, "0")}</DialogTitle>
          <DialogDescription>{fmtLongDate(schedule.schedule_date)}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="historico">
          <TabsList>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="space-y-2 pt-3">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
            ) : (
              <ol className="space-y-2">
                {history.map((row) => (
                  <li key={row.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium">
                      {row.user?.full_name ?? "Sistema"} — {row.action}
                    </p>
                    {row.field_changed ? (
                      <p className="text-xs text-muted-foreground">
                        {row.field_changed}: {row.old_value ?? "—"} → {row.new_value ?? "—"}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{fmtDateTime(row.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="ocorrencias" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="incident-kind">Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="incident-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_KINDS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {INCIDENT_LABEL[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label htmlFor="incident-description">Descrição</Label>
              <Textarea
                id="incident-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button size="sm" onClick={() => void saveIncident()}>
                Registrar ocorrência
              </Button>
            </div>

            <ol className="space-y-2">
              {incidents.map((row) => (
                <li key={row.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{INCIDENT_LABEL[row.kind] ?? row.kind}</p>
                  <p>{row.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.user?.full_name ?? "—"} · {fmtDateTime(row.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
