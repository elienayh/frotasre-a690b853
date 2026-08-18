import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  Plus, 
  Calendar, 
  ClipboardCheck, 
  ClipboardList,
  Clock3
} from "lucide-react";
import { useState, useMemo } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { TripDrawer } from "@/components/TripDrawer";
import { TripCard } from "@/components/TripCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/viagens")({
  component: MinhasViagens,
});

function MinhasViagens() {
  const { user } = useAuth();
  const [tripId, setTripId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("proximas");

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["my-trips-comprehensive", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(`
          id, code, status, departure_at, return_at, destination_text, purpose, passengers,
          occupants_names, requester_name, requester_id, allows_rides, admin_notes, requester_notes,
          needs_sre_driver, requested_driver_id, vehicle_id, assigned_driver_user_id, city_id, city_text,
          cities(name),
          vehicles(plate, manufacturer, model),
          assigned:profiles!trip_requests_assigned_driver_user_id_fkey(full_name),
          requester:profiles!trip_requests_requester_id_fkey(full_name, sector),
          occupants:trip_occupants(user_id)
        `)
        .or(`requester_id.eq.${user!.id},assigned_driver_user_id.eq.${user!.id},trip_occupants.user_id.eq.${user!.id}`)
        .order("departure_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredTrips = useMemo(() => {
    let result = [...trips];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.destination_text.toLowerCase().includes(search) ||
        t.code.toString().includes(search) ||
        (t.purpose && t.purpose.toLowerCase().includes(search))
      );
    }

    const now = new Date().toISOString();

    if (activeTab === "proximas") {
      result = result.filter(t => t.departure_at >= now && t.status !== "CANCELADA" && t.status !== "REJEITADA");
    } else if (activeTab === "aguardando") {
      result = result.filter(t => ["PENDENTE", "CORRECAO"].includes(t.status));
    } else if (activeTab === "realizadas") {
      result = result.filter(t => t.departure_at < now || t.status === "CONCLUIDA");
    } else if (activeTab === "canceladas") {
      result = result.filter(t => ["CANCELADA", "REJEITADA"].includes(t.status));
    }

    return result;
  }, [trips, searchTerm, activeTab]);

  const stats = useMemo(() => {
    const now = new Date().toISOString();
    return {
      proximas: trips.filter(t => t.departure_at >= now && t.status !== "CANCELADA" && t.status !== "REJEITADA").length,
      aguardando: trips.filter(t => ["PENDENTE", "CORRECAO"].includes(t.status)).length,
      realizadas: trips.filter(t => t.departure_at < now || t.status === "CONCLUIDA").length,
    };
  }, [trips]);

  return (
    <AppShell
      title="Minhas Viagens"
      description="Acompanhe todas as suas viagens e solicitações em um só lugar."
      actions={
        <Button asChild size="sm" className="rounded-xl shadow-lg shadow-primary/20">
          <Link to="/solicitacoes/nova" search={{ initialDate: undefined }}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova Solicitação
          </Link>
        </Button>
      }
    >
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard 
            icon={<Calendar className="h-5 w-5 text-primary" />} 
            label="Próximas" 
            value={stats.proximas} 
            active={activeTab === "proximas"}
            onClick={() => setActiveTab("proximas")}
          />
          <StatCard 
            icon={<Clock3 className="h-5 w-5 text-warning" />} 
            label="Aguardando" 
            value={stats.aguardando}
            active={activeTab === "aguardando"}
            onClick={() => setActiveTab("aguardando")}
          />
          <StatCard 
            icon={<ClipboardCheck className="h-5 w-5 text-success" />} 
            label="Realizadas" 
            value={stats.realizadas}
            active={activeTab === "realizadas"}
            onClick={() => setActiveTab("realizadas")}
          />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-muted/50 p-1 rounded-xl w-full md:w-auto h-auto">
              <TabsTrigger value="todas" className="rounded-lg px-4 py-2 font-bold text-xs uppercase tracking-widest transition-all">Todas</TabsTrigger>
              <TabsTrigger value="proximas" className="rounded-lg px-4 py-2 font-bold text-xs uppercase tracking-widest transition-all">Próximas</TabsTrigger>
              <TabsTrigger value="aguardando" className="rounded-lg px-4 py-2 font-bold text-xs uppercase tracking-widest transition-all">Aguardando</TabsTrigger>
              <TabsTrigger value="realizadas" className="rounded-lg px-4 py-2 font-bold text-xs uppercase tracking-widest transition-all">Realizadas</TabsTrigger>
              <TabsTrigger value="canceladas" className="rounded-lg px-4 py-2 font-bold text-xs uppercase tracking-widest transition-all">Canceladas</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar viagem..." 
              className="pl-10 rounded-xl border-border/40 bg-card/60 backdrop-blur-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 rounded-3xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 rounded-3xl border-2 border-dashed border-border/40 bg-muted/5">
            <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-foreground">Nenhuma viagem encontrada</p>
              <p className="text-sm text-muted-foreground">Tente ajustar seus filtros ou faça uma nova solicitação.</p>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
               <Link to="/solicitacoes/nova" search={{ initialDate: undefined }}>Nova Solicitação</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {filteredTrips.map((t) => (
              <TripCard 
                key={t.id} 
                trip={t as any} 
                onClick={() => setTripId(t.id)} 
              />
            ))}
          </div>
        )}
      </div>

      <TripDrawer tripId={tripId} onClose={() => setTripId(null)} />
    </AppShell>
  );
}

function StatCard({ icon, label, value, active, onClick }: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-300 hover:scale-[1.02] border-none shadow-sm",
        active ? "bg-primary/10 ring-2 ring-primary/20 shadow-md" : "bg-card/60 backdrop-blur-xl hover:shadow-lg"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-background flex items-center justify-center shadow-inner">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</p>
          <p className="text-3xl font-black text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
