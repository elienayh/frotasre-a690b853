import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateTimeToIso, friendlyDbError, todayInput, type TripRow } from "@/lib/frota";

const schema = z
  .object({
    date: z.string().min(1, { message: "Informe a data da viagem" }),
    departure: z.string().min(1, { message: "Informe o horário de saída" }),
    ret: z.string().min(1, { message: "Informe o horário previsto de retorno" }),
    destination_text: z
      .string()
      .trim()
      .min(3, { message: "Informe o destino" })
      .max(160),
    purpose: z.string().trim().min(5, { message: "Descreva o motivo da viagem" }).max(600),
    passengers: z.coerce.number().int().min(1).max(60),
    occupants_names: z.string().trim().max(600).optional(),
    suggested_driver: z.string().trim().max(120).optional(),
    requester_notes: z.string().trim().max(600).optional(),
    allows_rides: z.boolean(),
  })
  .refine((v) => v.ret > v.departure, {
    message: "O retorno deve ser posterior à saída",
    path: ["ret"],
  });

export interface TripFormProps {
  /** Solicitação existente para edição; ausente cria uma nova. */
  trip?: TripRow;
}

export function TripForm({ trip }: TripFormProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [destinationId, setDestinationId] = useState<string>(trip?.destination_id ?? "custom");
  const [allowsRides, setAllowsRides] = useState<boolean>(trip?.allows_rides ?? true);

  const { data: destinations = [] } = useQuery({
    queryKey: ["destinations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("destinations")
        .select("id, name, city")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const initialDate = trip ? new Date(trip.departure_at) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaults = {
    date: initialDate
      ? `${initialDate.getFullYear()}-${pad(initialDate.getMonth() + 1)}-${pad(initialDate.getDate())}`
      : todayInput(),
    departure: initialDate ? `${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}` : "08:00",
    ret: trip
      ? `${pad(new Date(trip.return_at).getHours())}:${pad(new Date(trip.return_at).getMinutes())}`
      : "17:00",
  };

  const selected = destinations.find((d) => d.id === destinationId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      date: form.get("date"),
      departure: form.get("departure"),
      ret: form.get("ret"),
      destination_text: destinationId === "custom" ? form.get("destination_text") : selected?.name,
      purpose: form.get("purpose"),
      passengers: form.get("passengers"),
      occupants_names: form.get("occupants_names") || undefined,
      suggested_driver: form.get("suggested_driver") || undefined,
      requester_notes: form.get("requester_notes") || undefined,
      allows_rides: allowsRides,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }

    const v = parsed.data;
    const payload = {
      requester_id: user?.id ?? null,
      requester_name: profile?.full_name ?? null,
      destination_id: destinationId === "custom" ? null : destinationId,
      destination_text: v.destination_text,
      purpose: v.purpose,
      passengers: v.passengers,
      occupants_names: v.occupants_names ?? null,
      suggested_driver: v.suggested_driver ?? null,
      requester_notes: v.requester_notes ?? null,
      allows_rides: v.allows_rides,
      departure_at: dateTimeToIso(v.date, v.departure),
      return_at: dateTimeToIso(v.date, v.ret),
      status: "PENDENTE" as const,
    };

    setBusy(true);
    const { error } = trip
      ? await supabase.from("trip_requests").update(payload).eq("id", trip.id)
      : await supabase.from("trip_requests").insert(payload);
    setBusy(false);

    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    toast.success(
      trip ? "Solicitação atualizada e reenviada ao DAFI." : "Solicitação enviada ao DAFI.",
    );
    void navigate({ to: "/solicitacoes" });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quando</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Data da viagem</Label>
              <Input id="date" name="date" type="date" defaultValue={defaults.date} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departure">Horário de saída</Label>
              <Input
                id="departure"
                name="departure"
                type="time"
                defaultValue={defaults.departure}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ret">Retorno previsto</Label>
              <Input id="ret" name="ret" type="time" defaultValue={defaults.ret} required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Para onde e por quê</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="destination">Destino</Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger id="destination">
                  <SelectValue placeholder="Selecione o destino" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                      {d.city ? ` · ${d.city}` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Outro destino…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {destinationId === "custom" ? (
              <div className="space-y-2">
                <Label htmlFor="destination_text">Informe o destino</Label>
                <Input
                  id="destination_text"
                  name="destination_text"
                  maxLength={160}
                  defaultValue={trip?.destination_text ?? ""}
                  placeholder="Escola Estadual / cidade"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="purpose">Motivo da viagem</Label>
              <Textarea
                id="purpose"
                name="purpose"
                rows={3}
                maxLength={600}
                defaultValue={trip?.purpose ?? ""}
                placeholder="Ex.: Visita técnica de acompanhamento pedagógico"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quem vai</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="passengers">Número de ocupantes</Label>
                <Input
                  id="passengers"
                  name="passengers"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={trip?.passengers ?? 1}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suggested_driver">Motorista sugerido (opcional)</Label>
                <Input
                  id="suggested_driver"
                  name="suggested_driver"
                  maxLength={120}
                  defaultValue={trip?.suggested_driver ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupants_names">Nomes dos ocupantes</Label>
              <Textarea
                id="occupants_names"
                name="occupants_names"
                rows={2}
                maxLength={600}
                defaultValue={trip?.occupants_names ?? ""}
                placeholder="Um nome por linha"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requester_notes">Observações</Label>
              <Textarea
                id="requester_notes"
                name="requester_notes"
                rows={2}
                maxLength={600}
                defaultValue={trip?.requester_notes ?? ""}
              />
            </div>
            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <Checkbox
                id="allows_rides"
                checked={allowsRides}
                onCheckedChange={(c) => setAllowsRides(c === true)}
              />
              <Label htmlFor="allows_rides" className="text-sm font-normal leading-snug">
                Aceito caronas de outros servidores nesta viagem, se houver lugares livres.
              </Label>
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="border-info/40 bg-info/5">
          <CardHeader>
            <CardTitle className="text-base">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              O veículo e o motorista <strong>não são escolhidos pelo solicitante</strong>. O DAFI
              analisa o pedido e define o transporte conforme a disponibilidade da frota.
            </p>
            <p>Você será notificado quando a solicitação for aprovada, ajustada ou recusada.</p>
            <p>O registro oficial no PW/Prodemge é feito pelo DAFI após a aprovação.</p>
          </CardContent>
        </Card>
        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy ? "Enviando…" : trip ? "Salvar e reenviar" : "Enviar solicitação"}
        </Button>
      </aside>
    </form>
  );
}
