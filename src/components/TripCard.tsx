import { AgendaTrip, tripCity, tripDriverName } from "@/hooks/useAgenda";
import { fmtTime, statusTone, TRIP_STATUS_LABEL } from "@/lib/frota";
import { sectorColor } from "@/lib/setores";
import { cn } from "@/lib/utils";
import { Car, User, Clock, MapPin } from "lucide-react";

interface TripCardProps {
  trip: AgendaTrip;
  onClick: (id: string) => void;
  compact?: boolean;
}

export function TripCard({ trip, onClick, compact = false }: TripCardProps) {
  const color = sectorColor(trip.requester?.sector);
  const statusColor = statusTone(trip.status);

  if (compact) {
    return (
      <button
        onClick={() => onClick(trip.id)}
        className={cn(
          "w-full rounded-lg border px-2 py-1.5 text-left text-[10px] leading-tight transition-all hover:bg-accent/20 border-border/40 bg-card/40 backdrop-blur-sm shadow-sm",
          color.border
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-black text-primary truncate">
            {fmtTime(trip.departure_at)} · {tripCity(trip).toUpperCase()}
          </span>
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", color.dot)} />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onClick(trip.id)}
      className={cn(
        "w-full group rounded-2xl border bg-card/40 backdrop-blur-xl p-4 text-left transition-all hover:shadow-xl hover:shadow-primary/5 hover:scale-[1.01] active:scale-[0.98] border-border/40",
        color.border
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-lg text-primary text-[10px] font-black tracking-tight">
               <Clock className="h-3 w-3" />
               {fmtTime(trip.departure_at)}
             </div>
             <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
          </div>
          <h4 className="font-display text-base font-black uppercase tracking-tight text-foreground truncate">
            {tripCity(trip)}
          </h4>
        </div>
        
        <div className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
          statusColor
        )}>
          {TRIP_STATUS_LABEL[trip.status] || trip.status}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-start gap-2 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p className="text-xs font-semibold leading-tight line-clamp-2">
            {trip.destination_text}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              <Car className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Veículo</p>
              <p className="text-[10px] font-black truncate leading-none">
                {trip.vehicles ? `${trip.vehicles.manufacturer} ${trip.vehicles.model}` : "A definir"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              <User className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Motorista</p>
              <p className="text-[10px] font-black truncate leading-none">
                {tripDriverName(trip)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
