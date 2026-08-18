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
      description={isAdmin ? "Gestão Estratégica da DAFI" : "Visão geral do seu setor"}
      actions={
        <Button asChild size="sm" className="rounded-xl shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95">
          <Link to="/solicitacoes/nova">
            <Plus className="mr-1.5 h-4 w-4" /> Nova solicitação
          </Link>
        </Button>
      }
    >
      <div className="space-y-10">
        {isAdmin ? (
          <section className="space-y-8">
            <FleetAlerts />
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Indicator
                icon={<CheckCircle2 className="h-5 w-5 text-success" />}
                label="Disponíveis"
                value={fleetCount("DISPONIVEL")}
                color="success"
              />
              <Indicator
                icon={<CarFront className="h-5 w-5 text-info" />}
                label="Ocupados"
                value={fleetCount("EM_VIAGEM") + fleetCount("RESERVADO")}
                color="info"
              />
              <Indicator
                icon={<Wrench className="h-5 w-5 text-destructive" />}
                label="Manutenção"
                value={fleetCount("EM_MANUTENCAO") + fleetCount("INDISPONIVEL")}
                color="destructive"
              />
              <Indicator
                icon={<ClipboardList className="h-5 w-5 text-warning" />}
                label="Pendentes"
                value={counts?.pending ?? 0}
                to="/admin/solicitacoes"
                color="warning"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Indicator
                icon={<Users className="h-5 w-5 text-primary" />}
                label="Caronas"
                value={counts?.rides ?? 0}
                to="/agenda-publica"
              />
              <Indicator
                icon={<UserCheck className="h-5 w-5 text-primary" />}
                label="Motoristas Faltando"
                value={counts?.needsDriver ?? 0}
                to="/admin/solicitacoes"
              />
              <Indicator
                icon={<UserCheck className="h-5 w-5 text-success" />}
                label="Motoristas Livres"
                value={`${counts?.driversFree ?? 0}/${counts?.driversTotal ?? 0}`}
                to="/admin/usuarios"
                color="success"
              />
              <Indicator
                icon={<CalendarRange className="h-5 w-5 text-primary" />}
                label="Em Viagem Agora"
                value={fleetCount("EM_VIAGEM")}
                to="/admin/disponibilidade"
              />
            </div>
          </section>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                <ClipboardList className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Minhas solicitações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-4xl font-black text-foreground">{myTrips.length}</p>
                <Button variant="link" asChild className="p-0 h-auto mt-4 text-primary font-bold">
                  <Link to="/solicitacoes">Ver histórico completo →</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                <CalendarRange className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" /> Calendário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground font-medium mb-4">
                  Visualize todas as viagens programadas pela regional.
                </p>
                <Button variant="outline" asChild className="w-full rounded-xl">
                  <Link to="/agenda-publica">Abrir calendário</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                <CarFront className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                  <CarFront className="h-4 w-4" /> Próximas viagens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground font-medium mb-4">
                  Acompanhe os detalhes dos seus próximos deslocamentos.
                </p>
                <Button variant="outline" asChild className="w-full rounded-xl">
                  <Link to="/viagens">Visualizar viagens</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {myTrips.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">Suas próximas viagens</h2>
              <Button variant="ghost" size="sm" asChild className="text-primary font-bold">
                <Link to="/viagens">Ver todas</Link>
              </Button>
            </div>
            <div className="grid gap-3">
              {myTrips.map((t) => (
                <Link 
                  key={t.id} 
                  to="/viagens" 
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/40 bg-card/60 p-4 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-primary/20 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-accent/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="block font-bold text-foreground group-hover:text-primary transition-colors">{t.destination_text}</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {fmtDate(t.departure_at)} · {fmtTime(t.departure_at)} – {fmtTime(t.return_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={t.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">Status Atual da Frota</h2>
            <Card className="border-none bg-transparent shadow-none p-0">
              <FleetSituation />
            </Card>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

import { MapPin, ChevronRight } from "lucide-react";

function Indicator({
  icon,
  label,
  value,
  to,
  color = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  to?: string;
  color?: "primary" | "success" | "warning" | "destructive" | "info";
}) {
  const colorMap = {
    primary: "border-primary/20 hover:border-primary/50",
    success: "border-success/20 hover:border-success/50",
    warning: "border-warning/20 hover:border-warning/50",
    destructive: "border-destructive/20 hover:border-destructive/50",
    info: "border-info/20 hover:border-info/50",
  };

  const bgMap = {
    primary: "bg-primary/5",
    success: "bg-success/5",
    warning: "bg-warning/5",
    destructive: "bg-destructive/5",
    info: "bg-info/5",
  };

  const content = (
    <div className={cn(
      "group relative flex flex-col justify-between rounded-2xl border bg-card/60 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
      colorMap[color]
    )}>
      <div className={cn("absolute top-0 right-0 m-3 h-8 w-8 rounded-full opacity-10 transition-transform group-hover:scale-110", bgMap[color])} />
      <div>
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">{label}</span>
        </div>
        <p className="font-display text-3xl font-black text-foreground">{value}</p>
      </div>
    </div>
  );

  return to ? (
    <Link to={to} className="block">
      {content}
    </Link>
  ) : content;
}

