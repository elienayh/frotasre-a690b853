import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtTime } from "@/lib/frota";

interface RideRow {
  id: string;
  seats: number;
  reason: string | null;
  status: string;
  created_at: string;
  requester: { full_name: string; sector: string | null } | null;
  trip: {
    code: number;
    destination_text: string;
    departure_at: string;
    return_at: string;
  } | null;
}

/** Solicitações de carona pendentes e decididas, com aprovação pela DAFI. */
export function RideRequestsPanel() {
  const queryClient = useQueryClient();

  const { data: rides = [], isLoading } = useQuery({
    queryKey: ["admin-ride-requests"],
    queryFn: async (): Promise<RideRow[]> => {
      const { data, error } = await supabase
        .from("ride_requests")
        .select(
          `id, seats, reason, status, created_at,
           requester:profiles!ride_requests_requester_id_fkey(full_name, sector),
           trip:trip_requests!ride_requests_trip_id_fkey(code, destination_text, departure_at, return_at)`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RideRow[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APROVADA" | "REJEITADA" }) => {
      const { error } = await supabase.from("ride_requests").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Solicitação de carona atualizada.");
      void queryClient.invalidateQueries({ queryKey: ["admin-ride-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando caronas…</p>;
  if (rides.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Nenhuma solicitação de carona registrada.
      </p>
    );
  }

  return (
    <ul className="grid gap-4">
      {rides.map((ride) => (
        <li key={ride.id} className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-semibold">
                #{ride.trip?.code ?? "—"} · {ride.trip?.destination_text ?? "Viagem removida"}
              </p>
              <p className="text-sm text-muted-foreground">
                {ride.trip
                  ? `${fmtDate(ride.trip.departure_at)} · ${fmtTime(ride.trip.departure_at)} — ${fmtTime(ride.trip.return_at)}`
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                Solicitante: {ride.requester?.full_name ?? "—"}
                {ride.requester?.sector ? ` · ${ride.requester.sector}` : ""} ·{" "}
                {ride.seats} ocupante(s) pretendido(s)
              </p>
            </div>
            <StatusBadge status={ride.status} />
          </div>
          {ride.reason ? <p className="mt-3 text-sm">Motivo: {ride.reason}</p> : null}

          {ride.status === "PENDENTE" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: ride.id, status: "APROVADA" })}
              >
                Aprovar carona
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: ride.id, status: "REJEITADA" })}
              >
                Recusar
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
