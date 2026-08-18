import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Wrench } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtKm } from "@/lib/frota";

export function FleetAlerts() {
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["fleet-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, plate, manufacturer, model, odometer, next_preventive_km, is_active")
        .eq("is_active", true)
        .order("plate");
      if (error) throw error;
      
      // Filtra veículos com odômetro próximo da manutenção (500km ou já passou)
      return (data ?? []).filter(v => 
        (v.next_preventive_km ?? 0) > 0 && 
        (v.odometer || 0) >= ((v.next_preventive_km ?? 0) - 500)
      );
    }
  });

  if (isLoading || vehicles.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertCircle className="h-4 w-4" />
          Alertas de Frota ({vehicles.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => {
            const nextKm = v.next_preventive_km ?? 0;
            const isOverdue = (v.odometer || 0) >= nextKm;
            return (
              <li key={v.id} className="rounded-md border border-destructive/20 bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold">{v.plate}</span>
                  <Badge variant={isOverdue ? "destructive" : "outline"} className={isOverdue ? "text-[10px] uppercase" : "text-[10px] uppercase text-warning border-warning/30"}>
                    {isOverdue ? "Vencida" : "Próxima"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{v.manufacturer} {v.model}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>{fmtKm(v.odometer)} / {fmtKm(nextKm)}</span>
                  <Link 
                    to="/admin/veiculos/$vehicleId" 
                    params={{ vehicleId: v.id }}
                    className="flex items-center text-primary hover:underline"
                  >
                    <Wrench className="mr-1 h-3 w-3" />
                    Revisar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
