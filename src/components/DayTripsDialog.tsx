import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { tripCity, type AgendaTrip } from "@/hooks/useAgenda";
import { fmtTime, TRIP_STATUS_LABEL } from "@/lib/frota";
import { sectorColor } from "@/lib/setores";
import { cn } from "@/lib/utils";

export interface DayTripsDialogProps {
  /** Data selecionada; `null` mantém o modal fechado. */
  date: Date | null;
  /** Viagens do dia selecionado (sem limite de exibição). */
  trips: AgendaTrip[];
  /** Exibe a ação de criação apenas para quem pode solicitar viagem. */
  canCreate: boolean;
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
  onCreateTrip: (date: Date) => void;
}

const LONG_DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Modal de consulta com todas as viagens de um dia do Cronograma. */
export function DayTripsDialog({
  date,
  trips,
  canCreate,
  onClose,
  onSelectTrip,
  onCreateTrip,
}: DayTripsDialogProps) {
  const ordered = [...trips].sort(
    (a, b) => new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime(),
  );

  return (
    <Dialog open={Boolean(date)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-lg rounded-3xl border-border/40 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/40 px-6 py-5">
          <DialogTitle className="font-display text-xl font-black capitalize tracking-tight">
            {date ? LONG_DATE.format(date) : ""}
          </DialogTitle>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
            {ordered.length === 0
              ? "Nenhuma viagem"
              : `${ordered.length} ${ordered.length === 1 ? "viagem" : "viagens"}`}
          </p>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto px-4 py-3">
          {ordered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm font-medium text-muted-foreground">
              Nenhuma viagem programada para este dia.
            </p>
          ) : (
            ordered.map((t) => {
              const color = sectorColor(t.requester?.sector);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTrip(t.id)}
                  className={cn(
                    "flex w-full items-start gap-4 rounded-2xl border border-l-4 px-4 py-3 text-left transition-colors hover:bg-accent/40",
                    color.border,
                  )}
                >
                  <span className={cn("mt-0.5 text-xs font-black tabular-nums", color.text)}>
                    {fmtTime(t.departure_at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black uppercase tracking-tight text-foreground">
                      {tripCity(t)}
                    </span>
                    <span className="block truncate text-xs font-medium text-muted-foreground">
                      {t.destination_text}
                    </span>
                  </span>
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                    {TRIP_STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {canCreate && date ? (
          <div className="border-t border-border/40 px-6 py-4">
            <Button className="w-full rounded-xl font-bold" onClick={() => onCreateTrip(date)}>
              <Plus className="mr-2 h-4 w-4" /> Nova viagem
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
