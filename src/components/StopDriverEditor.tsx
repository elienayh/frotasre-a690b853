import { MapPin } from "lucide-react";
import { toast } from "sonner";

import { DriverPicker } from "@/components/DriverPicker";
import { Badge } from "@/components/ui/badge";
import {
  stopDriverName,
  stopRowLabel,
  useSetStopDriver,
  useTripStops,
} from "@/hooks/useTripStops";
import { cn } from "@/lib/utils";

export interface StopDriverEditorProps {
  tripId: string;
  /** Somente leitura para quem não pode definir motoristas. */
  readOnly?: boolean | undefined;
  /** Restringe a lista a motoristas da SRE. */
  onlySreDrivers?: boolean | undefined;
  className?: string | undefined;
}

/** Destinos da viagem com o motorista responsável por cada trecho. */
export function StopDriverEditor({
  tripId,
  readOnly = false,
  onlySreDrivers = false,
  className,
}: StopDriverEditorProps) {
  const { data: stops = [], isLoading } = useTripStops(tripId);
  const setDriver = useSetStopDriver(tripId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando destinos…</p>;
  }
  if (stops.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        Esta solicitação não tem destinos detalhados.
      </p>
    );
  }

  return (
    <ul className={cn("grid gap-3", className)}>
      {stops.map((stop, index) => (
        <li key={stop.id} className="rounded-md border border-border bg-card/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
              {index + 1}. {stopRowLabel(stop)}
            </p>
            {stop.driver_user_id ? (
              <Badge variant="secondary">{stopDriverName(stop)}</Badge>
            ) : (
              <Badge variant="outline" className="border-dashed">
                DAFI DEFINIR
              </Badge>
            )}
          </div>
          {readOnly ? null : (
            <div className="mt-2">
              <DriverPicker
                id={`stop-driver-${stop.id}`}
                value={stop.driver_user_id}
                onChange={(driverId) =>
                  setDriver.mutate(
                    { stopId: stop.id, driverId },
                    { onError: (e: Error) => toast.error(e.message) },
                  )
                }
                placeholder="DAFI DEFINIR"
                onlySreDrivers={onlySreDrivers}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
