import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Gauge } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface TripMileageDialogProps {
  trip: any;
  vehicle: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "start" | "end";
  onSuccess: () => void;
}

export function TripMileageDialog({
  trip,
  vehicle,
  isOpen,
  onOpenChange,
  mode,
  onSuccess,
}: TripMileageDialogProps) {
  const { user } = useAuth();
  const [km, setKm] = useState<number>(vehicle?.odometer || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!km || km < 0) {
      setError("Informe uma quilometragem válida.");
      return;
    }

    if (km < vehicle.odometer) {
      setError(`A quilometragem informada (${km}) é menor que a última registrada no veículo (${vehicle.odometer}).`);
      return;
    }

    if (mode === "end" && trip.odometer_start && km < trip.odometer_start) {
      setError(`A quilometragem de retorno (${km}) não pode ser menor que a de saída (${trip.odometer_start}).`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updateData: any = mode === "start" 
        ? { odometer_start: km, status: "EM_ANDAMENTO" }
        : { odometer_end: km, status: "CONCLUIDA" };

      // Update Trip
      const { error: tripError } = await supabase
        .from("trip_requests")
        .update(updateData)
        .eq("id", trip.id);

      if (tripError) throw tripError;

      // Update Vehicle Odometer
      const { error: vehicleError } = await supabase
        .from("vehicles")
        .update({ odometer: km })
        .eq("id", vehicle.id);

      if (vehicleError) throw vehicleError;

      // Record History
      const { error: historyError } = await supabase.from("odometer_history").insert({
        vehicle_id: vehicle.id,
        old_value: vehicle.odometer,
        new_value: km,
        origin: mode === "start" ? "trip_start" : "trip_end",
        trip_id: trip.id,
        recorded_by: user?.id || null,
      });


      if (historyError) throw historyError;

      toast.success(mode === "start" ? "Viagem iniciada." : "Viagem finalizada.");
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            {mode === "start" ? "Registrar Saída" : "Registrar Retorno"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p><strong>Veículo:</strong> {vehicle?.plate} - {vehicle?.manufacturer} {vehicle?.model}</p>
            <p><strong>Último KM registrado:</strong> {vehicle?.odometer?.toLocaleString()} km</p>
            {mode === "end" && trip.odometer_start && (
              <p><strong>KM de saída desta viagem:</strong> {trip.odometer_start.toLocaleString()} km</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="km-input">Odômetro Atual (KM)</Label>
            <Input
              id="km-input"
              type="number"
              value={km}
              onChange={(e) => setKm(Number(e.target.value))}
              className="text-lg font-bold"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : mode === "start" ? "Confirmar Saída" : "Confirmar Retorno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
