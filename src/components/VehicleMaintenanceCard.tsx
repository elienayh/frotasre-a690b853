import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Wrench, Droplets, CircleSlash, Settings2, Target, Filter, Wind } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MaintenanceItemProps {
  label: string;
  currentKm: number;
  lastKm: number | null;
  nextKm: number | null;
  icon: React.ReactNode;
  compact?: boolean | undefined;
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

  const totalInterval = nextKm && lastKm ? Math.max(1, nextKm - lastKm) : 0;
  const elapsed = nextKm && lastKm ? currentKm - lastKm : 0;
  const hasHistory = lastKm !== null && lastKm > 0;
  
  // Progress calculation
  // Normal: 0-70% | Warning: 70-90% | Urgent: 90-100% | Expired: >100%
  const progress = hasHistory && totalInterval > 0
    ? Math.min(Math.max((elapsed / totalInterval) * 100, 0), 100)
    : 0;

  const remaining = nextKm - currentKm;
  const isExpired = currentKm >= nextKm;

  let status: "normal" | "warning" | "urgent" | "expired" = "normal";
  if (isExpired) status = "expired";
  else {
    const percentageUsed = progress;
    if (percentageUsed >= 90) status = "urgent";
    else if (percentageUsed >= 70) status = "warning";
    else status = "normal";
  }

  const statusColors = {
    normal: "bg-success",
    warning: "bg-warning",
    urgent: "bg-destructive",
    expired: "bg-destructive animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]",
  };

  const textColors = {
    normal: "text-success",
    warning: "text-warning",
    urgent: "text-destructive",
    expired: "text-destructive font-black underline decoration-2 underline-offset-4",
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
        <span className={cn(
          "font-bold tabular-nums", 
          isExpired ? "text-destructive" : "text-muted-foreground",
          compact ? "text-[8px]" : "text-[10px]"
        )}>
          {isExpired ? "-" : ""}{Math.abs(remaining).toLocaleString()} km
        </span>
      </div>
      
      <div className="relative">
        <div className={cn(
          "w-full rounded-full bg-muted/40 border border-border/10 overflow-hidden", 
          compact ? "h-2" : "h-2.5"
        )}>
          <div 
            className={cn(
              "h-full transition-all duration-1000 ease-out",
              statusColors[status]
            )}
            style={{ width: `${isExpired ? 100 : progress}%` }}
          />
        </div>
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
          label="Filtro de Óleo"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_oil_filter_change_km}
          nextKm={vehicle.next_oil_filter_change_km}
          icon={<Filter className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
          compact={compact}
        />
        <MaintenanceItem
          label="Filtro de Ar"
          currentKm={vehicle.odometer}
          lastKm={vehicle.last_air_filter_change_km}
          nextKm={vehicle.next_air_filter_change_km}
          icon={<Wind className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />}
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
