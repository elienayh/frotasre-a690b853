import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { AllocateDialog } from "@/components/AllocateDialog";
import { RideRequestsPanel } from "@/components/RideRequestsPanel";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtDate, fmtTime, friendlyDbError, type TripRow } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/admin/solicitacoes")({
  component: AdminSolicitacoes,
});

type Decision = { trip: TripRow; kind: "REJEITADA" | "CORRECAO" } | null;

function AdminSolicitacoes() {
  const queryClient = useQueryClient();
  const search = Route.useSearch() as { tab?: string };
  const [allocating, setAllocating] = useState<TripRow | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [activeTab, setActiveTab] = useState(search?.tab || "pendentes");

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["admin-trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select("*")
        .order("departure_at");
      if (error) throw error;
      return data;
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      id,
      kind,
      reason,
    }: {
      id: string;
      kind: "REJEITADA" | "CORRECAO";
      reason: string;
    }) => {
      const { error } = await supabase
        .from("trip_requests")
        .update({ status: kind, rejection_reason: reason })
        .eq("id", id);
      if (error) throw new Error(friendlyDbError(error.message));
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada.");
      setDecision(null);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = trips.filter((t) => ["PENDENTE", "CORRECAO"].includes(t.status));
  const scheduled = trips.filter((t) =>
    ["APROVADA", "PROGRAMADA", "EM_ANDAMENTO"].includes(t.status),
  );
  const closed = trips.filter((t) =>
    ["CONCLUIDA", "REJEITADA", "CANCELADA"].includes(t.status),
  );

  const renderList = (list: TripRow[], allowActions: boolean) =>
    list.length === 0 ? (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Nada por aqui.
      </p>
    ) : (
      <ul className="grid gap-4">
        {list.map((t) => (
          <li key={t.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setAllocating(t)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAllocating(t);
                }
              }}
              className="w-full cursor-pointer rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold">
                    #{t.code} · {t.destination_text}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ida {fmtDate(t.departure_at)} às {fmtTime(t.departure_at)} · Retorno{" "}
                    {fmtDate(t.return_at)} às {fmtTime(t.return_at)} · {t.passengers} ocupante(s)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Solicitante: {t.requester_name ?? "—"}
                  </p>
                </div>
                <StatusBadge status={t.status as string} />
              </div>
              <p className="mt-3 text-sm">{t.purpose}</p>
              {t.requester_notes ? (
                <p className="mt-1 text-sm text-muted-foreground">Obs.: {t.requester_notes}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAllocating(t);
                  }}
                >
                  {allowActions ? "Definir transporte" : "Reajustar transporte"}
                </Button>
                {allowActions ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDecision({ trip: t, kind: "CORRECAO" });
                      }}
                    >
                      Solicitar correção
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDecision({ trip: t, kind: "REJEITADA" });
                      }}
                    >
                      Recusar
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );


  return (
    <AppShell
      title="Aprovações de Viagem"
      description="Analise os pedidos, defina veículo, motorista e horário definitivo."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pendentes">Pendentes ({pending.length})</TabsTrigger>
            <TabsTrigger value="programadas">Programadas ({scheduled.length})</TabsTrigger>
            <TabsTrigger value="encerradas">Encerradas ({closed.length})</TabsTrigger>
            <TabsTrigger value="caronas">Solicitações de Carona</TabsTrigger>
          </TabsList>
          <TabsContent value="pendentes" className="mt-4">
            {renderList(pending, true)}
          </TabsContent>
          <TabsContent value="programadas" className="mt-4">
            {renderList(scheduled, false)}
          </TabsContent>
          <TabsContent value="encerradas" className="mt-4">
            {renderList(closed, false)}
          </TabsContent>
          <TabsContent value="caronas" className="mt-4">
            <RideRequestsPanel />
          </TabsContent>
        </Tabs>
      )}


      <AllocateDialog trip={allocating} onClose={() => setAllocating(null)} />

      <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.kind === "REJEITADA" ? "Recusar solicitação" : "Solicitar correção"}
            </DialogTitle>
          </DialogHeader>
          <form
            id="decision-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const reason = String(form.get("reason") ?? "").trim();
              if (reason.length < 5) {
                toast.error("Descreva o motivo para o solicitante.");
                return;
              }
              decide.mutate({ id: decision!.trip.id as string, kind: decision!.kind, reason });
            }}
          >
            <Label htmlFor="reason">Motivo</Label>
            <Textarea id="reason" name="reason" rows={3} maxLength={400} required />
          </form>
          <DialogFooter>
            <Button type="submit" form="decision-form" disabled={decide.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
