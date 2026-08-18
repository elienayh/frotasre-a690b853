import { cn } from "@/lib/utils";
import { FLEET_STATUS_LABEL, TRIP_STATUS_LABEL, statusTone } from "@/lib/frota";

export interface StatusBadgeProps {
  status: string;
  kind?: "trip" | "fleet";
  className?: string;
}

export function StatusBadge({ status, kind = "trip", className }: StatusBadgeProps) {
  const label =
    (kind === "trip" ? TRIP_STATUS_LABEL[status] : FLEET_STATUS_LABEL[status]) ??
    FLEET_STATUS_LABEL[status] ??
    TRIP_STATUS_LABEL[status] ??
    status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xl border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shadow-sm",
        statusTone(status),
        className,
      )}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-pulse" />
      {label}
    </span>
  );
}

