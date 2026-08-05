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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        statusTone(status),
        className,
      )}
    >
      {label}
    </span>
  );
}
