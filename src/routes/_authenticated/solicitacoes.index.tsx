import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtTime, friendlyDbError } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/solicitacoes/")({
  component: MinhasSolicitacoes,
});

function MinhasSolicitacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["my-requests", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(
          "id, code, destination_text, purpose, passengers, departure_at, return_at, status, rejection_reason, admin_notes, vehicle_id, assigned_driver_user_id, vehicles(plate, manufacturer, model), assigned:profiles!trip_requests_assigned_driver_user_id_fkey(full_name)",
        )
        .eq("requester_id", user!.id)
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("trip_requests")
        .update({ status: "CANCELADA" })
        .eq("id", id);
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Solicitação cancelada.");
      void queryClient.invalidateQueries({ queryKey: ["my-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Minhas Solicitações"
      description="Acompanhe o andamento dos seus pedidos de viagem"
      actions={
        <Button asChild size="sm">
          <Link to="/solicitacoes/nova">
            <Plus className="mr-1 h-4 w-4" /> Nova
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : trips.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma solicitação registrada.
        </p>
      ) : (
        <ul className="grid gap-4">
          {trips.map((t) => {
            const approved = ["APROVADA", "PROGRAMADA", "EM_ANDAMENTO", "CONCLUIDA"].includes(
              t.status,
            );
            const editable = ["PENDENTE", "CORRECAO"].includes(t.status);
            return (
              <li key={t.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold">
                      Solicitação #{t.code} · {t.destination_text}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ida {fmtDate(t.departure_at)} às {fmtTime(t.departure_at)} · Retorno{" "}
                      {fmtDate(t.return_at)} às {fmtTime(t.return_at)} · {t.passengers} ocupante(s)
                    </p>

                  </div>
                  <StatusBadge status={t.status} />
                </div>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Veículo</dt>
                    <dd className="font-medium">
                      {approved && t.vehicles
                        ? `${t.vehicles.manufacturer} ${t.vehicles.model} — ${t.vehicles.plate}`
                        : "A DEFINIR PELA DAFI"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Motorista</dt>
                    <dd className="font-medium">
                      {t.assigned?.full_name ?? "A DEFINIR"}
                    </dd>
                  </div>
                </dl>

                {t.rejection_reason ? (
                  <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {t.rejection_reason}
                  </p>
                ) : null}
                {t.admin_notes ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Observações da DAFI: {t.admin_notes}
                  </p>
                ) : null}

                {editable ? (
                  <div className="mt-4 flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/solicitacoes/$tripId/editar" params={{ tripId: t.id }}>
                        Editar
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancel.mutate(t.id)}
                      disabled={cancel.isPending}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
