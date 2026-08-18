import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarRange,
  CarFront,
  CheckCircle2,
  ClipboardList,
  Plus,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFleetNow } from "@/hooks/useFleet";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtTime } from "@/lib/frota";
import { FleetSituation } from "@/components/FleetSituation";
import { FleetAlerts } from "@/components/FleetAlerts";

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

  const { data: fleet = [] } = useFleetNow();

  const { data: counts } = useQuery({
    queryKey: ["dafi-counts"],
    enabled: isAdmin,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [pending, rides, needsDriver, sreDrivers, busyDrivers] = await Promise.all([
        supabase
          .from("trip_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["PENDENTE", "CORRECAO"]),
        supabase
          .from("ride_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDENTE"),
        supabase
          .from("trip_requests")
          .select("id", { count: "exact", head: true })
          .eq("needs_sre_driver", true)
          .is("assigned_driver_user_id", null)
          .gte("return_at", nowIso)
          .in("status", ["PENDENTE", "CORRECAO", "APROVADA", "PROGRAMADA"]),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_sre_driver", true)
          .eq("is_active", true),
        supabase
          .from("trip_requests")
          .select("assigned_driver_user_id")
          .not("assigned_driver_user_id", "is", null)
          .lte("departure_at", nowIso)
          .gte("return_at", nowIso)
          .in("status", ["APROVADA", "PROGRAMADA", "EM_ANDAMENTO"]),
      ]);
      const busy = new Set(
        (busyDrivers.data ?? []).map((r) => r.assigned_driver_user_id).filter(Boolean),
      );
      return {
        pending: pending.count ?? 0,
        rides: rides.count ?? 0,
        needsDriver: needsDriver.count ?? 0,
        driversTotal: sreDrivers.count ?? 0,
        driversFree: Math.max(0, (sreDrivers.count ?? 0) - busy.size),
      };
    },
  });

  const fleetCount = (status: string) => fleet.filter((v) => v.status === status).length;

  return (
    <AppShell
      title={`Olá, ${profile?.full_name?.split(" ")[0] || "servidor"}`}
      description={isAdmin ? "Painel da DAFI" : "Painel do servidor"}
      actions={
        <Button asChild size="sm">
          <Link to="/solicitacoes/nova">
            <Plus className="mr-1 h-4 w-4" /> Nova solicitação
          </Link>
        </Button>
      }
    >
      {isAdmin ? (
        <section className="mb-8 space-y-6">
          <FleetAlerts />
          
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicator
            icon={<CheckCircle2 className="h-4 w-4 text-success" />}
            label="Veículos disponíveis"
            value={fleetCount("DISPONIVEL")}
          />
          <Indicator
            icon={<CarFront className="h-4 w-4 text-info" />}
            label="Veículos ocupados"
            value={fleetCount("EM_VIAGEM") + fleetCount("RESERVADO")}
          />
          <Indicator
            icon={<Wrench className="h-4 w-4 text-destructive" />}
            label="Em manutenção"
            value={fleetCount("EM_MANUTENCAO") + fleetCount("INDISPONIVEL")}
          />
          <Indicator
            icon={<ClipboardList className="h-4 w-4 text-warning" />}
            label="Solicitações pendentes"
            value={counts?.pending ?? 0}
            to="/admin/solicitacoes"
          />
          <Indicator
            icon={<Users className="h-4 w-4 text-warning" />}
            label="Pedidos de carona"
            value={counts?.rides ?? 0}
            to="/agenda-publica"
          />
          <Indicator
            icon={<UserCheck className="h-4 w-4 text-warning" />}
            label="Motoristas necessários"
            value={counts?.needsDriver ?? 0}
            to="/admin/solicitacoes"
          />
          <Indicator
            icon={<UserCheck className="h-4 w-4 text-success" />}
            label="Motoristas disponíveis"
            value={`${counts?.driversFree ?? 0}/${counts?.driversTotal ?? 0}`}
            to="/admin/usuarios"
          />
          <Indicator
            icon={<CalendarRange className="h-4 w-4 text-primary" />}
            label="Agenda do dia"
            value={fleetCount("EM_VIAGEM")}
            to="/admin/disponibilidade"
          />
          </div>
        </section>
      ) : (
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ClipboardList className="h-4 w-4" /> Minhas solicitações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold">{myTrips.length}</p>
              <Link
                to="/solicitacoes"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Ver todas
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarRange className="h-4 w-4" /> Calendário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Veja as viagens do mês e peça carona.
              </p>
              <Link
                to="/agenda-publica"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Abrir calendário
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CarFront className="h-4 w-4" /> Minhas viagens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Acompanhe seus deslocamentos.</p>
              <Link
                to="/viagens"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Ver viagens
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {myTrips.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-base font-semibold">Suas próximas viagens</h2>
          <ul className="grid gap-2">
            {myTrips.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
              >
                <span>
                  <span className="font-medium">{t.destination_text}</span>
                  <span className="block text-muted-foreground">
                    {fmtDate(t.departure_at)} · {fmtTime(t.departure_at)} –{" "}
                    {fmtTime(t.return_at)}
                  </span>
                </span>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isAdmin ? (
        <section>
          <h2 className="mb-3 font-display text-base font-semibold">Situação da frota agora</h2>
          <FleetSituation />
        </section>
      ) : null}
    </AppShell>
  );
}

function Indicator({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  to?: string;
}) {
  const body = (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
