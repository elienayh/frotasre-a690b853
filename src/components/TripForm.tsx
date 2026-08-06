import { useEffect, useState } from "react";
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
import { DriverPicker } from "@/components/DriverPicker";
import { TripStops, newStop, stopLabel, type StopValue } from "@/components/TripStops";
import { useCities, usePeople, usePlaces } from "@/hooks/useFrotaOptions";
import { dateTimeToIso, fmtDate, friendlyDbError, todayInput, type TripRow } from "@/lib/frota";

const schema = z
  .object({
    date: z.string().min(1, { message: "Informe a data da viagem" }),
    departure: z.string().min(1, { message: "Informe o horário de saída" }),
    ret: z.string().min(1, { message: "Informe o horário previsto de retorno" }),
    purpose: z.string().trim().min(5, { message: "Descreva o motivo da viagem" }).max(600),
    passengers: z.coerce.number().int().min(1).max(60),
    occupants_names: z.string().trim().max(600).optional(),
    requester_notes: z.string().trim().max(600).optional(),
    allows_rides: z.boolean(),
  })
  .refine((v) => v.ret > v.departure, {
    message: "O retorno deve ser posterior à saída",
    path: ["ret"],
  });

type FormValues = z.infer<typeof schema>;

export interface TripFormProps {
  /** Solicitação existente para edição; ausente cria uma nova. */
  trip?: TripRow;
}

export function TripForm({ trip }: TripFormProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: cities = [] } = useCities();
  const { data: places = [] } = usePlaces();
  const { data: people = [] } = usePeople();

  const [busy, setBusy] = useState(false);
  const [stops, setStops] = useState<StopValue[]>([newStop()]);
  const [allowsRides, setAllowsRides] = useState<boolean>(trip?.allows_rides ?? true);
  const [driverId, setDriverId] = useState<string | null>(
    trip?.requested_driver_id ?? user?.id ?? null,
  );
  const [noDriver, setNoDriver] = useState<boolean>(
    Boolean(trip) && !trip?.requested_driver_id,
  );
  const [review, setReview] = useState<FormValues | null>(null);

  // Carrega as paradas já registradas quando a solicitação está em edição.
  const { data: savedStops } = useQuery({
    queryKey: ["trip-stops", trip?.id],
    enabled: Boolean(trip?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_stops")
        .select("city_id, city_text, destination_id, place_text, position")
        .eq("trip_id", trip!.id)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!trip) return;
    if (savedStops && savedStops.length > 0) {
      setStops(
        savedStops.map((s) => ({
          key: Math.random().toString(36).slice(2),
          cityId: s.city_id,
          cityText: s.city_text,
          destinationId: s.destination_id,
          placeText: s.place_text,
        })),
      );
    } else if (savedStops) {
      setStops([
        {
          key: "legacy",
          cityId: trip.city_id,
          cityText: trip.city_text,
          destinationId: trip.destination_id,
          placeText: trip.destination_id ? null : trip.destination_text,
        },
      ]);
    }
  }, [savedStops, trip]);

  const initialDate = trip ? new Date(trip.departure_at) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaults = {
    date: initialDate
      ? `${initialDate.getFullYear()}-${pad(initialDate.getMonth() + 1)}-${pad(initialDate.getDate())}`
      : todayInput(),
    departure: initialDate
      ? `${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}`
      : "08:00",
    ret: trip
      ? `${pad(new Date(trip.return_at).getHours())}:${pad(new Date(trip.return_at).getMinutes())}`
      : "17:00",
  };

  function describeStop(stop: StopValue) {
    const cityName = stop.cityId ? (cities.find((c) => c.id === stop.cityId)?.name ?? null) : null;
    const placeName = stop.destinationId
      ? (places.find((p) => p.id === stop.destinationId)?.name ?? null)
      : null;
    return stopLabel(stop, cityName, placeName);
  }

  function validStops(): StopValue[] {
    return stops.filter(
      (s) => (s.cityId || s.cityText) && (s.destinationId || s.placeText),
    );
  }

  function handleReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      date: form.get("date"),
      departure: form.get("departure"),
      ret: form.get("ret"),
      purpose: form.get("purpose"),
      passengers: form.get("passengers"),
      occupants_names: form.get("occupants_names") || undefined,
      requester_notes: form.get("requester_notes") || undefined,
      allows_rides: allowsRides,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados informados");
      return;
    }
    if (validStops().length === 0) {
      toast.error("Informe pelo menos um destino com cidade e local.");
      return;
    }
    if (!noDriver && !driverId) {
      toast.error("Indique quem irá dirigir ou marque que o DAFI deve definir.");
      return;
    }
    setReview(parsed.data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleConfirm() {
    if (!review) return;
    const list = validStops();
    const first = list[0]!;
    const summary = list.map(describeStop).join(" | ");
    const requestedDriver = noDriver ? null : driverId;
    const driverName = requestedDriver
      ? (people.find((p) => p.id === requestedDriver)?.full_name ?? null)
      : null;

    const payload = {
      requester_id: user?.id ?? null,
      requester_name: profile?.full_name ?? null,
      city_id: first.cityId,
      city_text: first.cityText,
      destination_id: first.destinationId,
      destination_text: summary.slice(0, 400),
      requested_driver_id: requestedDriver,
      suggested_driver: driverName,
      purpose: review.purpose,
      passengers: review.passengers,
      occupants_names: review.occupants_names ?? null,
      requester_notes: review.requester_notes ?? null,
      allows_rides: review.allows_rides,
      departure_at: dateTimeToIso(review.date, review.departure),
      return_at: dateTimeToIso(review.date, review.ret),
      status: "PENDENTE" as const,
    };

    setBusy(true);
    try {
      let tripId = trip?.id ?? null;
      if (trip) {
        const { error } = await supabase.from("trip_requests").update(payload).eq("id", trip.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("trip_requests")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        tripId = data.id;
      }

      if (tripId) {
        await supabase.from("trip_stops").delete().eq("trip_id", tripId);
        const { error: stopsError } = await supabase.from("trip_stops").insert(
          list.map((stop, index) => ({
            trip_id: tripId,
            position: index + 1,
            city_id: stop.cityId,
            city_text: stop.cityText,
            destination_id: stop.destinationId,
            place_text: stop.placeText,
          })),
        );
        if (stopsError) throw new Error(stopsError.message);
      }

      toast.success(
        trip ? "Solicitação atualizada e reenviada ao DAFI." : "Solicitação enviada ao DAFI.",
      );
      void navigate({ to: "/solicitacoes" });
    } catch (error) {
      toast.error(friendlyDbError((error as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (review) {
    const list = validStops();
    const driverName = noDriver
      ? "A definir pelo DAFI"
      : (people.find((p) => p.id === driverId)?.full_name ?? "—");
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confira antes de enviar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Data" value={fmtDate(dateTimeToIso(review.date, review.departure))} />
            <Row label="Saída" value={review.departure} />
            <Row label="Retorno previsto" value={review.ret} />
            <div>
              <p className="text-muted-foreground">Itinerário</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {list.map((stop) => (
                  <li key={stop.key}>{describeStop(stop)}</li>
                ))}
              </ol>
            </div>
            <Row label="Motivo" value={review.purpose} />
            <Row label="Ocupantes" value={String(review.passengers)} />
            {review.occupants_names ? (
              <Row label="Nomes" value={review.occupants_names} />
            ) : null}
            <Row label="Condutor indicado" value={driverName} />
            <Row label="Aceita caronas" value={review.allows_rides ? "Sim" : "Não"} />
            {review.requester_notes ? (
              <Row label="Observações" value={review.requester_notes} />
            ) : null}
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setReview(null)} disabled={busy}>
            Voltar
          </Button>
          <Button className="flex-1" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? "Enviando…" : trip ? "Salvar e reenviar" : "Enviar solicitação"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleReview} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
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
            <CardTitle className="text-base">Para onde</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TripStops value={stops} onChange={setStops} />
            <p className="text-xs text-muted-foreground">
              Cada parada tem cidade e local próprios. Se a cidade ou o local não estiverem
              cadastrados, digite o nome e escolha a opção de usar o texto informado.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Motivo</CardTitle>
          </CardHeader>
          <CardContent>
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
                <Label htmlFor="driver">Quem irá dirigir</Label>
                <DriverPicker
                  id="driver"
                  value={noDriver ? null : driverId}
                  onChange={setDriverId}
                  currentUserId={user?.id ?? null}
                  disabled={noDriver}
                />
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="no-driver"
                    checked={noDriver}
                    onCheckedChange={(c) => setNoDriver(c === true)}
                  />
                  <Label htmlFor="no-driver" className="text-sm font-normal leading-snug">
                    Não indicar — o DAFI define o condutor
                  </Label>
                </div>
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
              O veículo é definido pelo DAFI. Sua indicação de condutor é uma sugestão: o DAFI
              confirma ou substitui conforme a disponibilidade.
            </p>
            <p>Você será notificado quando a solicitação for aprovada, ajustada ou recusada.</p>
            <p>O registro oficial no PW/Prodemge é feito pelo DAFI após a aprovação.</p>
          </CardContent>
        </Card>
        <Button type="submit" className="w-full" size="lg">
          Revisar e enviar
        </Button>
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
