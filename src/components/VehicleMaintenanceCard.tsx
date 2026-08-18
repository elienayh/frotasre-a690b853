import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Wrench, AlertTriangle, CheckCircle2, Clock, Droplets, CircleSlash, Settings2, Target } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MaintenanceItemProps {
  label: string;
  currentKm: number;
  lastKm: number | null;
  nextKm: number | null;
  icon: React.ReactNode;
}

function MaintenanceItem({ label, currentKm, lastKm, nextKm, icon }: MaintenanceItemProps) {
  if (!nextKm) {
    return (
      <div className="space-y-1.5 opacity-40 grayscale group/item">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                <div className="p-1.5 rounded-lg bg-muted/20">
                  {icon}
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest">NÃO CONFIG.</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-bold">{label}: Não configurado</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="h-1.5 w-full rounded-full bg-muted/20" />
      </div>
    );
  }

  const effectiveLastKm = lastKm ?? currentKm;
  const totalInterval = Math.max(1, nextKm - effectiveLastKm);
  const elapsed = currentKm - effectiveLastKm;
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

  return (
    <div className="space-y-1.5 group/item">
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-2 cursor-help transition-transform group-hover/item:scale-105",
                textColors[status]
              )}>
                <div className={cn("p-1.5 rounded-lg", status === 'normal' ? 'bg-success/10' : 'bg-muted/10')}>
                  {icon}
                </div>
                {currentKm >= nextKm && (
                  <span className="text-[9px] font-black uppercase tracking-widest">VENCIDA</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-bold">{label}</p>
              <p className="text-[10px] opacity-80">
                {currentKm >= nextKm 
                  ? `${(currentKm - nextKm).toLocaleString()} km acima do limite` 
                  : `${remaining.toLocaleString()} km restantes`}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-[9px] font-bold text-muted-foreground/60 tabular-nums">
          {remaining.toLocaleString()} km
        </span>
      </div>
      
      <div className="relative">
        <Progress 
          value={progress} 
          className="h-1.5 rounded-full bg-muted/30 overflow-hidden" 
          indicatorClassName={cn(
            "transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]",
            statusColors[status]
          )} 
        />
        {!hasHistory && (
          <span className="absolute inset-0 flex items-center justify-center text-[6px] font-black uppercase tracking-[0.2em] text-muted-foreground/20 pointer-events-none">
            S/ HISTÓRICO
          </span>
        )}
      </div>
    </div>
  );
}

export function VehicleMaintenanceCard({ vehicle }: { vehicle: any }) {
  if (!vehicle) return null;
  
  return (
    <div className="space-y-4 rounded-[1.5rem] border border-border/40 bg-card/40 p-5 backdrop-blur-md shadow-sm transition-all hover:shadow-xl hover:border-primary/20">
      <div className="flex items-center gap-2 border-b border-border/40 pb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wrench className="h-3 w-3" />
        </div>
        <div>
          <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
            Manutenção Preventiva
          </h4>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-2 xs:grid-cols-1">
        <MaintenanceItem
          label="Troca de Óleo"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_oil_change_km}
          nextKm={vehicle.next_oil_change_km}
          icon={<Droplets className="h-3.5 w-3.5" />}
        />
        <MaintenanceItem
          label="Pneus"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_tire_change_km}
          nextKm={vehicle.next_tire_change_km}
          icon={<CircleSlash className="h-3.5 w-3.5" />}
        />
        <MaintenanceItem
          label="Alinhamento"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_alignment_km}
          nextKm={vehicle.next_alignment_km}
          icon={<Settings2 className="h-3.5 w-3.5" />}
        />
        <MaintenanceItem
          label="Balanceamento"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_balancing_km}
          nextKm={vehicle.next_balancing_km}
          icon={<Target className="h-3.5 w-3.5" />}
        />
      </div>
    </div>
  );
}
