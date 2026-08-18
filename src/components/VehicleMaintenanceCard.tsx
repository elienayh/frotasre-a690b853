import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Wrench, Droplets, CircleSlash, Settings2, Target } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MaintenanceItemProps {
  label: string;
  currentKm: number;
  lastKm: number | null;
  nextKm: number | null;
  icon: React.ReactNode;
  compact?: boolean;
}

function MaintenanceItem({ label, currentKm, lastKm, nextKm, icon, compact }: MaintenanceItemProps) {
  if (!nextKm) {
    return (
      <div className={cn("space-y-1.5 opacity-40 grayscale group/item", compact && "space-y-1")}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-muted-foreground cursor-help">
                <div className={cn("rounded-lg bg-muted/20", compact ? "p-1" : "p-1.5")}>
                  {icon}
                </div>
                {!compact && <span className="text-[9px] font-black uppercase tracking-widest">NÃO CONFIG.</span>}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-bold">{label}: Não configurado</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className={cn("w-full rounded-full bg-muted/20", compact ? "h-1" : "h-1.5")} />
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
    <div className={cn("space-y-1.5 group/item", compact && "space-y-1")}>
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-2 cursor-help transition-transform group-hover/item:scale-105",
                textColors[status]
              )}>
                <div className={cn("rounded-lg", status === 'normal' ? 'bg-success/10' : 'bg-muted/10', compact ? "p-1" : "p-1.5")}>
                  {icon}
                </div>
                {currentKm >= nextKm && !compact && (
                  <span className="text-[9px] font-black uppercase tracking-widest">VENCIDA</span>
                )}
                {currentKm >= nextKm && compact && (
                  <span className="text-[8px] font-black uppercase tracking-widest leading-none">VENCIDA</span>
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
        <span className={cn("font-bold tabular-nums", compact ? "text-[8px] text-muted-foreground/50" : "text-[9px] text-muted-foreground/60")}>
          {remaining.toLocaleString()} km
        </span>
      </div>
      
      <div className="relative">
        <Progress 
          value={progress} 
          className={cn("rounded-full bg-muted/30 overflow-hidden", compact ? "h-1" : "h-1.5")} 
          indicatorClassName={cn(
            "transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]",
            statusColors[status]
          )} 
        />
        {!hasHistory && (
          <span className={cn("absolute inset-0 flex items-center justify-center font-black uppercase tracking-[0.2em] text-muted-foreground/20 pointer-events-none", compact ? "text-[5px]" : "text-[6px]")}>
            S/ HISTÓRICO
          </span>
        )}
      </div>
    </div>
  );
}

export function VehicleMaintenanceCard({ vehicle, compact }: { vehicle: any; compact?: boolean }) {
  if (!vehicle) return null;
  
  return (
    <div className={cn(
      "rounded-3xl border border-border/40 bg-card/40 backdrop-blur-md shadow-sm transition-all hover:shadow-xl hover:border-primary/20",
      compact ? "p-4 space-y-3" : "p-6 space-y-4"
    )}>
      <div className={cn("flex items-center gap-2 border-b border-border/40", compact ? "pb-2" : "pb-3")}>
        <div className={cn("flex items-center justify-center rounded-lg bg-primary/10 text-primary", compact ? "h-5 w-5" : "h-6 w-6")}>
          <Wrench className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
        </div>
        <div>
          <h4 className={cn("font-black uppercase tracking-[0.2em] text-primary", compact ? "text-[8px]" : "text-[9px]")}>
            Manutenção Preventiva
          </h4>
        </div>
      </div>
      
      <div className={cn(
        "grid gap-x-6 gap-y-4",
        compact ? "grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-2 xs:grid-cols-1" : "grid-cols-2"
      )}>
        <MaintenanceItem
          label="Troca de Óleo"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_oil_change_km}
          nextKm={vehicle.next_oil_change_km}
          icon={<Droplets className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
          compact={compact}
        />
        <MaintenanceItem
          label="Pneus"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_tire_change_km}
          nextKm={vehicle.next_tire_change_km}
          icon={<CircleSlash className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
          compact={compact}
        />
        <MaintenanceItem
          label="Alinhamento"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_alignment_km}
          nextKm={vehicle.next_alignment_km}
          icon={<Settings2 className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
          compact={compact}
        />
        <MaintenanceItem
          label="Balanceamento"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_balancing_km}
          nextKm={vehicle.next_balancing_km}
          icon={<Target className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
          compact={compact}
        />
      </div>
    </div>
  );
}
