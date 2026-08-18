import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { notifyRideDecision } from "@/lib/email.functions";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtTime } from "@/lib/frota";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface RideRow {
  id: string;
  seats: number;
  reason: string | null;
  status: string;
  created_at: string;
  requester_id: string;
  requester: { full_name: string; sector: string | null } | null;
  trip: {
    id: string;
    code: number;
    destination_text: string;
    departure_at: string;
    return_at: string;
  } | null;
}

interface RideDecisionDialogProps {
  ride: RideRow | null;
  onClose: () => void;
}

export function RideDecisionDialog({ ride, onClose }: RideDecisionDialogProps) {
  const queryClient = useQueryClient();
  const notifyEmail = useServerFn(notifyRideDecision);

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APROVADA" | "REJEITADA" }) => {
      const { error } = await supabase.from("ride_requests").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Solicitação de carona atualizada.");
      // Envio de e-mail assíncrono
      void notifyEmail({
        data: {
          rideId: ride.id,
          userId: ride.requester_id,
          status: decide.variables?.status === "APROVADA" ? "APROVADA" : "REJEITADA"
        }
      }).catch(err => console.error("Erro ao enviar e-mail de carona:", err));
      void queryClient.invalidateQueries({ queryKey: ["admin-ride-requests-all"] });
      void queryClient.invalidateQueries({ queryKey: ["pending-counts"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ride) return null;

  return (
    <Dialog open={!!ride} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Analisar Solicitação de Carona</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Viagem Relacionada</p>
            <p className="mt-1 font-semibold">
              #{ride.trip?.code} · {ride.trip?.destination_text}
            </p>
            <p className="text-sm text-muted-foreground">
              {fmtDate(ride.trip?.departure_at)} · {fmtTime(ride.trip?.departure_at)} — {fmtTime(ride.trip?.return_at)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Solicitante</p>
              <p className="text-sm font-medium">{ride.requester?.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{ride.requester?.sector ?? "Sem setor"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ocupantes</p>
              <p className="text-sm font-medium">{ride.seats} pessoa(s)</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Motivo</p>
            <p className="mt-1 text-sm">{ride.reason || "Não informado."}</p>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status Atual:</p>
            <StatusBadge status={ride.status} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {ride.status === "PENDENTE" && (
            <>
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: ride.id, status: "REJEITADA" })}
              >
                Recusar
              </Button>
              <Button
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: ride.id, status: "APROVADA" })}
              >
                Aprovar Carona
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
