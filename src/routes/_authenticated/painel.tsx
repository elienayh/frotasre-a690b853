import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, CarFront, ClipboardList, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtTime } from "@/lib/frota";
import { FleetSituation } from "@/components/FleetSituation";

export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelPage,
});

function PainelPage() {
  const { profile, isAdmin, user } = useAuth();

  const { data: myTrips = [] } = useQuery({
    queryKey: ["my-trips", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select("id, code, destination_text, departure_at, return_at, status")
        .eq("requester_id", user!.id)
        .order("departure_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-count"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("trip_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["PENDENTE", "CORRECAO"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <AppShell
      title={`Olá, ${profile?.full_name?.split(" ")[0] || "servidor"}`}
      description={isAdmin ? "Painel do DAFI" : "Painel do servidor"}
      actions={
        <Button asChild size="sm">
          <Link to="/solicitacoes/nova">
            <Plus className="mr-1 h-4 w-4" /> Nova solicitação
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ClipboardList className="h-4 w-4" /> Minhas solicitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">{myTrips.length}</p>
            <Link to="/solicitacoes" className="text-sm text-primary underline-offset-4 hover:underline">
              Ver todas
            </Link>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ClipboardList className="h-4 w-4" /> Aguardando análise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold">{pendingCount}</p>
              <Link
                to="/admin/solicitacoes"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Analisar agora
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarRange className="h-4 w-4" /> Agenda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Consulte as viagens programadas e peça carona.
            </p>
            <Link
              to="/agenda-publica"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Viagens programadas
            </Link>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Próximas solicitações</h2>
        {myTrips.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Você ainda não possui solicitações. Crie a primeira em “Nova solicitação”.
          </p>
        ) : (
          <ul className="grid gap-3">
            {myTrips.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium">
                    #{t.code} · {t.destination_text}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {fmtDate(t.departure_at)} · {fmtTime(t.departure_at)} às {fmtTime(t.return_at)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <CarFront className="h-5 w-5" /> Situação da Frota
          </h2>
          <FleetSituation />
        </section>
      ) : null}
    </AppShell>
  );
}
