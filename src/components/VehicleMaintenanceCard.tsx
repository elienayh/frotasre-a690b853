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
  if (!nextKm || !lastKm) {
    return (
      <div className="space-y-1.5 opacity-60">
        <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          <span>Não configurado</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted" />
      </div>
    );
  }

  const totalInterval = nextKm - lastKm;
  const elapsed = currentKm - lastKm;
  const progress = Math.min(Math.max((elapsed / totalInterval) * 100, 0), 100);
  const remaining = Math.max(nextKm - currentKm, 0);

  let status: "normal" | "warning" | "urgent" | "expired" = "normal";
  if (remaining <= 0) status = "expired";
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
    expired: "text-destructive font-bold",
  };

  const icons = {
    normal: <CheckCircle2 className="h-3 w-3" />,
    warning: <Clock className="h-3 w-3" />,
    urgent: <AlertTriangle className="h-3 w-3" />,
    expired: <Wrench className="h-3 w-3" />,
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium uppercase tracking-wider">
        <span className="text-muted-foreground">{label}</span>
        <div className={cn("flex items-center gap-1", textColors[status])}>
          {icons[status]}
          <span>{remaining > 0 ? `${remaining.toLocaleString()} km resta(m)` : "Vencida"}</span>
        </div>
      </div>
      <Progress value={progress} className="h-2" indicatorClassName={statusColors[status]} />
    </div>
  );
}

export function VehicleMaintenanceCard({ vehicle }: { vehicle: any }) {
  return (
    <div className="space-y-4 rounded-md border border-border/50 bg-muted/30 p-4">
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Manutenção Preventiva
        </h4>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
