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
import { Separator } from "@/components/ui/separator";
import { friendlyDbError } from "@/lib/frota";

interface TripMileageDialogProps {
  trip?: any;
  vehicle: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "start" | "end" | "manual";
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
  const { user, isAdmin, isSuperAdmin, profile } = useAuth();
  const isSreDriver = profile?.is_sre_driver || false;
  const [km, setKm] = useState<number>(vehicle?.odometer || 0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpdateLowerKm = isAdmin || isSuperAdmin;
  const canUpdateManual = isAdmin || isSuperAdmin || isSreDriver;

  const handleSubmit = async () => {
    if (km === undefined || km === null || km < 0) {
      setError("Informe uma quilometragem válida.");
      return;
    }

    if (km < (vehicle?.odometer || 0) && !canUpdateLowerKm) {
      setError(`A quilometragem informada (${km}) é menor que a última registrada no veículo (${vehicle?.odometer}). Somente administradores podem realizar correções para valores menores.`);
      return;
    }

    if (mode === "end" && trip?.odometer_start && km < trip.odometer_start && !canUpdateLowerKm) {
      setError(`A quilometragem de retorno (${km}) não pode ser menor que a de saída (${trip.odometer_start}).`);
      return;
    }

    if (mode === "manual" && !reason) {
      setError("Informe o motivo da alteração manual.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Atualizar Viagem se for o caso
      if ((mode === "start" || mode === "end") && trip?.id) {
        const updateData: any = mode === "start" 
          ? { odometer_start: km, status: "EM_ANDAMENTO", departure_at: new Date().toISOString() }
          : { odometer_end: km, status: "CONCLUIDA" };

        const { error: tripError } = await supabase
          .from("trip_requests")
          .update(updateData)
          .eq("id", trip.id);

        if (tripError) throw tripError;
      }

      // 2. Chamar RPC unificada para atualizar odômetro do veículo e gravar histórico
      const { error: rpcError } = await supabase.rpc("update_vehicle_odometer", {
        _vehicle_id: vehicle.id,
        _new_value: km,
        _recorded_by: user?.id ?? "",
        _origin: mode === "start" ? "trip_start" : mode === "end" ? "trip_end" : "manual_adjustment",
        _trip_id: trip?.id || null,
        _reason: mode === "manual" ? reason : mode === "start" ? "Início de viagem" : "Finalização de viagem"
      });

      if (rpcError) throw rpcError;

      toast.success(
        mode === "start" ? "Saída registrada e odômetro atualizado." : 
        mode === "end" ? "Viagem finalizada e odômetro atualizado." : 
        "Odômetro ajustado com sucesso."
      );
      
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(friendlyDbError(e.message));
    } finally {
      setLoading(false);
    }
  };

  const modeTitle = {
    start: "Registrar Saída",
    end: "Registrar Retorno",
    manual: "Ajuste Manual de Odômetro"
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            {modeTitle[mode]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-xl bg-muted/50 p-4 text-sm border border-border/40">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Veículo</span>
              <span className="font-bold">{vehicle?.plate}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Modelo</span>
              <span className="font-medium text-right">{vehicle?.manufacturer} {vehicle?.model}</span>
            </div>
            <Separator className="my-2 opacity-50" />
            <div className="flex justify-between">
              <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Odômetro Atual</span>
              <span className="font-black text-primary">{vehicle?.odometer?.toLocaleString()} km</span>
            </div>
            {mode === "end" && trip?.odometer_start && (
              <div className="flex justify-between mt-1 text-primary/80">
                <span className="text-[10px] font-bold tracking-wider uppercase">KM Saída da Viagem</span>
                <span className="font-bold">{trip.odometer_start.toLocaleString()} km</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="km-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Novo Odômetro (KM)
            </Label>
            <div className="relative">
              <Gauge className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="km-input"
                type="number"
                value={km}
                onChange={(e) => setKm(Number(e.target.value))}
                className="pl-9 text-lg font-black tabular-nums border-primary/20 focus-visible:ring-primary"
              />
            </div>
            {km > (vehicle?.odometer || 0) && (
              <p className="text-[10px] text-success font-bold px-1">
                + {(km - vehicle.odometer).toLocaleString()} km percorridos
              </p>
            )}
            {km < (vehicle?.odometer || 0) && (
              <p className="text-[10px] text-destructive font-bold px-1">
                Redução de {(vehicle.odometer - km).toLocaleString()} km (Apenas Admin)
              </p>
            )}
          </div>

          {mode === "manual" && (
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Motivo do Ajuste
              </Label>
              <Input
                id="reason"
                placeholder="Ex: Deslocamento oficina, teste, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="border-primary/20"
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="rounded-xl border-destructive/20 bg-destructive/5 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl px-8 shadow-lg shadow-primary/20">
            {loading ? "Processando..." : mode === "start" ? "Confirmar Saída" : mode === "end" ? "Finalizar Viagem" : "Salvar Ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}