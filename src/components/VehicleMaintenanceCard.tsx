import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Wrench, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface MaintenanceItemProps {
  label: string;
  currentKm: number;
  lastKm: number | null;
  nextKm: number | null;
}

function MaintenanceItem({ label, currentKm, lastKm, nextKm }: MaintenanceItemProps) {
  if (!nextKm) {
    return (
      <div className="space-y-3 opacity-40 grayscale">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          <span>{label}</span>
          <span>NÃO CONFIGURADO</span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted/20" />
      </div>
    );
  }

  // Se não houver lastKm, assumimos que o intervalo começa no odometer atual (para evitar divisão por zero ou barras negativas)
  const effectiveLastKm = lastKm ?? currentKm;
  const totalInterval = Math.max(1, nextKm - effectiveLastKm);
  const elapsed = currentKm - effectiveLastKm;
  
  // Se não houver histórico anterior, mostramos "Sem histórico" mas permitimos ver o KM restante
  const hasHistory = lastKm !== null;
  
  const progress = hasHistory 
    ? Math.min(Math.max((elapsed / totalInterval) * 100, 0), 100)
    : 0;

  const remaining = Math.max(nextKm - currentKm, 0);

  let status: "normal" | "warning" | "urgent" | "expired" = "normal";
  if (currentKm >= nextKm) status = "expired";
  else if (remaining <= 500) status = "urgent";
  else if (remaining <= 1500) status = "warning";

  const statusColors = {
    normal: "bg-success",
    warning: "bg-warning",
    urgent: "bg-destructive",
    expired: "bg-destructive animate-pulse",
  };

  const textColors = {
    normal: "text-success",
    warning: "text-warning",
    urgent: "text-destructive",
    expired: "text-destructive font-black",
  };

  const icons = {
    normal: <CheckCircle2 className="h-3 w-3" />,
    warning: <Clock className="h-3 w-3" />,
    urgent: <AlertTriangle className="h-3 w-3" />,
    expired: <Wrench className="h-3 w-3" />,
  };

  return (
    <div className="space-y-3 group/item">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em]">
        <span className="text-muted-foreground/60 group-hover/item:text-primary transition-colors">{label}</span>
        <div className={cn("flex items-center gap-1.5 transition-transform group-hover/item:scale-105", textColors[status])}>
          {icons[status]}
          <span>
            {currentKm >= nextKm 
              ? `VENCIDA (${(currentKm - nextKm).toLocaleString()} KM ACIMA)` 
              : `${remaining.toLocaleString()} KM RESTA(M)`}
          </span>
        </div>
      </div>
      <div className="relative group/bar">
        <Progress 
          value={progress} 
          className="h-3 rounded-full bg-muted/30 overflow-hidden" 
          indicatorClassName={cn(
            "transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]",
            statusColors[status]
          )} 
        />
        {!hasHistory && (
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 pointer-events-none">
            SEM HISTÓRICO
          </span>
        )}
      </div>
    </div>
  );
}

export function VehicleMaintenanceCard({ vehicle }: { vehicle: any }) {
  if (!vehicle) return null;
  
  return (
    <div className="space-y-6 rounded-[2rem] border border-border/40 bg-card/40 p-6 backdrop-blur-md shadow-sm transition-all hover:shadow-xl hover:border-primary/20">
      <div className="flex items-center gap-3 border-b border-border/40 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wrench className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            Manutenção Preventiva
          </h4>
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Acompanhamento por Odômetro</p>
        </div>
      </div>
      <div className="grid gap-8 sm:grid-cols-2">
        <MaintenanceItem
          label="Troca de Óleo"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_oil_change_km}
          nextKm={vehicle.next_oil_change_km}
        />
        <MaintenanceItem
          label="Pneus"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_tire_change_km}
          nextKm={vehicle.next_tire_change_km}
        />
        <MaintenanceItem
          label="Alinhamento"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_alignment_km}
          nextKm={vehicle.next_alignment_km}
        />
        <MaintenanceItem
          label="Balanceamento"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_balancing_km}
          nextKm={vehicle.next_balancing_km}
        />
      </div>
    </div>
  );
}
