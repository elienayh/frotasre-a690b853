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
import { motion } from "framer-motion";

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
      // Buscamos viagens onde o usuário é solicitante, motorista ou ocupante
      const { data, error } = await supabase
        .from("trip_requests")
        .select(`
          id, code, destination_text, departure_at, return_at, status, passengers, purpose,
          requester:profiles!trip_requests_requester_id_fkey(full_name, sector),
          assigned:profiles!trip_requests_assigned_driver_user_id_fkey(full_name),
          vehicles(plate, manufacturer, model),
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

    // Busca por texto
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.destination_text.toLowerCase().includes(search) ||
        t.code.toString().includes(search) ||
        (t.purpose && t.purpose.toLowerCase().includes(search))
      );
    }

    const now = new Date().toISOString();

    // Filtros por Aba
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
        {/* KPIs Rápidos */}
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
                trip={t} 
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

function TripCard({ trip, onClick }: { trip: any; onClick: () => void }) {
  const color = sectorColor(trip.requester?.sector);
  const isPast = new Date(trip.departure_at) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group relative h-full"
    >
      <Card 
        className={cn(
          "h-full cursor-pointer overflow-hidden border-none bg-card/60 backdrop-blur-xl shadow-sm transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.98]",
          isPast && "grayscale-[0.3] opacity-90"
        )}
        onClick={onClick}
      >
        <div className={cn("h-1.5 w-full", color.dot, "opacity-60")} />
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter px-1.5 h-4 bg-muted/40">
                  #{trip.code}
                </Badge>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {fmtDate(trip.departure_at)}
                </span>
              </div>
              <h3 className="font-display text-lg font-black uppercase tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                {trip.destination_text}
              </h3>
            </div>
            <StatusBadge status={trip.status} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoItem 
              icon={<Clock className="h-3 w-3" />} 
              label="Saída" 
              value={fmtTime(trip.departure_at)} 
            />
            <InfoItem 
              icon={<Users className="h-3 w-3" />} 
              label="Ocupantes" 
              value={`${trip.occupants?.length || 0} de 5`} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
            <InfoItem 
              icon={<User className="h-3 w-3" />} 
              label="Motorista" 
              value={trip.assigned?.full_name || "A definir"} 
            />
            <InfoItem 
              icon={<Car className="h-3 w-3" />} 
              label="Veículo" 
              value={trip.vehicles ? `${trip.vehicles.manufacturer} ${trip.vehicles.model}` : "A definir"} 
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
             <Badge variant="outline" className={cn("text-[8px] font-black tracking-widest uppercase px-1.5", color.text, color.chip, color.border)}>
               {trip.requester?.sector || "SRE"}
             </Badge>
             <div className="flex items-center gap-1 text-[10px] font-bold text-primary group-hover:translate-x-1 transition-transform">
               Ver detalhes <ChevronRight className="h-3 w-3" />
             </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {icon} {label}
      </p>
      <p className="text-xs font-bold text-foreground truncate">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}