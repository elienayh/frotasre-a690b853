import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { notifyNewTripRequest } from "@/lib/email.functions";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OccupantsPicker, type OccupantDestPick } from "@/components/OccupantsPicker";
import { resolveDestinationId } from "@/hooks/useOccupantDestinations";
import { TripStops, newStop, stopLabel, type StopValue } from "@/components/TripStops";
import { useCities, usePeople, usePlaces } from "@/hooks/useFrotaOptions";
import { dateTimeToIso, fmtDate, friendlyDbError, todayInput, type TripRow } from "@/lib/frota";
import {
  calculateTripOccupancy,
  EXTERNAL_PREFIX,
  externalOccupantName,
  isExternalOccupant,
} from "@/lib/occupancy";


import { cn } from "@/lib/utils";

const schema = z
  .object({
    date: z.string().min(1, { message: "Informe a data da viagem" }),
    return_date: z.string().min(1, { message: "Informe a data de retorno" }),
    departure: z.string().min(1, { message: "Informe o horário de saída" }),
    ret: z.string().min(1, { message: "Informe o horário previsto de retorno" }),
    purpose: z.string().trim().min(5, { message: "Descreva o motivo da viagem" }).max(600),
    passengers: z.coerce.number().int().min(0).max(4),
    requester_notes: z.string().trim().max(600).optional(),
    allows_rides: z.boolean(),
  })
  .refine((v) => `${v.return_date}T${v.ret}` > `${v.date}T${v.departure}`, {
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
  const search = useSearch({ from: "/_authenticated/solicitacoes/nova" }) as any;
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  // Motoristas credenciados e administradores podem incluir pessoas sem cadastro.
  const canAddExternal = Boolean(isAdmin || isSuperAdmin || profile?.is_driver_certified);

  const notifyEmail = useServerFn(notifyNewTripRequest);
  const { data: cities = [] } = useCities();
  const { data: places = [] } = usePlaces();
  const { data: people = [] } = usePeople();

  const [busy, setBusy] = useState(false);
  const [stops, setStops] = useState<StopValue[]>([newStop()]);
  const [allowsRides, setAllowsRides] = useState<boolean>(trip?.allows_rides ?? true);
  const [passengers, setPassengers] = useState<number>(trip?.passengers ?? 0);
  const [occupantIds, setOccupantIds] = useState<(string | null)[]>([]);
  // Destinos individuais por ocupante, indexados pela chave do ocupante
  // (id do usuário ou `ext:Nome` para externos; motoristas usam o próprio id).
  const [occupantDests, setOccupantDests] = useState<Record<string, OccupantDestPick[]>>({});
  const [review, setReview] = useState<FormValues | null>(null);

  // Carrega as paradas já registradas quando a solicitação está em edição.
  const { data: savedStops } = useQuery({
    queryKey: ["trip-stops", trip?.id],
    enabled: Boolean(trip?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_stops")
        .select("city_id, city_text, destination_id, place_text, position, driver_user_id")
        .eq("trip_id", trip!.id || "")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Ocupantes já vinculados (usuários do sistema), para edição da solicitação.
  const { data: savedOccupants } = useQuery({
    queryKey: ["trip-occupants-form", trip?.id],
    enabled: Boolean(trip?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_occupants")
        .select("id, user_id, is_external, is_driver, external_name, removed_at")
        .eq("trip_id", trip!.id || "")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!savedOccupants) return;
    // Motoristas são controlados pelo campo do trecho, nunca pela lista de passageiros.
    // Ocupantes externos voltam para o formulário com o prefixo padrão.
    const ids = savedOccupants
      .filter((o) => !o.is_driver && !o.removed_at)
      .map((o) =>
        o.is_external
          ? `${EXTERNAL_PREFIX}${(o.external_name ?? "").trim()}`
          : o.user_id,
      )
      .filter((v): v is string => Boolean(v) && v !== EXTERNAL_PREFIX);
    if (ids.length > 0) setOccupantIds(ids);
  }, [savedOccupants]);



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
          driverUserId: s.driver_user_id,
        })),
      );
    } else if (savedStops) {
      setStops([
        {
          key: "legacy",
          cityId: trip.city_id ?? null,
          cityText: trip.city_text ?? null,
          destinationId: trip.destination_id ?? null,
          placeText: trip.destination_id ? null : (trip.destination_text ?? null),
          driverUserId: null,
        },
      ]);
    }
  }, [savedStops, trip]);

  const initialDate = trip ? new Date(trip.departure_at || "") : null;
  const initialReturn = trip ? new Date(trip.return_at || "") : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const asDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const defaults = {
    date: initialDate ? asDate(initialDate) : (search?.initialDate || todayInput()),
    return_date: initialReturn ? asDate(initialReturn) : (search?.initialDate || todayInput()),
    departure: initialDate
      ? `${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}`
      : "08:00",
    ret: initialReturn
      ? `${pad(initialReturn.getHours())}:${pad(initialReturn.getMinutes())}`
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
    return stops.filter((s) => (s.cityId || s.cityText) && (s.destinationId || s.placeText));
  }

  const occupancy = calculateTripOccupancy(stops, occupantIds, 5);

  // Um motorista definido em um trecho nunca pode ocupar também um campo de passageiro adicional.
  useEffect(() => {
    const driverIds = new Set(occupancy.uniqueDriverIds);
    if (!occupantIds.some((id) => id && driverIds.has(id))) return;
    setOccupantIds((prev) => prev.map((id) => (id && driverIds.has(id) ? null : id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occupancy.uniqueDriverIds.join(",")]);

  function selectedOccupants(count: number): string[] {
    return occupantIds.slice(0, count).filter(Boolean) as string[];
  }

  function handleReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      date: form.get("date"),
      return_date: form.get("return_date"),
      departure: form.get("departure"),
      ret: form.get("ret"),
      purpose: form.get("purpose"),
      passengers,
      requester_notes: form.get("requester_notes") || undefined,
      allows_rides: allowsRides,
    };

    const parsed = schema.safeParse(data);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      toast.error(firstError?.message ?? "Verifique os dados informados");

      // Tenta rolar até o campo com erro
      if (firstError?.path && firstError.path.length > 0) {
        const fieldName = String(firstError.path[0]);
        const element = document.getElementsByName(fieldName)[0] || document.getElementById(fieldName);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.focus();
          }
        }
      }
      return;
    }
    const occupancy = calculateTripOccupancy(validStops(), occupantIds, 5);

    if (occupancy.isExceeded) {
      toast.error(
        `A capacidade máxima é de 5 pessoas (1 motorista + 4 passageiros). Atualmente: ${occupancy.totalPeople} pessoas.`,
      );
      return;
    }

    if (validStops().length === 0) {
      toast.error("Informe pelo menos um destino com cidade e local.");
      return;
    }

    if (parsed.data.passengers > 0 && selectedOccupants(parsed.data.passengers).length < parsed.data.passengers) {
      toast.error("Selecione todos os passageiros da viagem.");
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
    const chosen = selectedOccupants(review.passengers);

    const payload = {
      requester_id: user?.id ?? null,
      requester_name: profile?.full_name ?? null,
      city_id: first.cityId,
      city_text: first.cityText,
      destination_id: first.destinationId,
      destination_text: summary.slice(0, 400),
      requested_driver_id: first.driverUserId,
      suggested_driver: null,
      purpose: review.purpose,
      passengers: review.passengers,
      requester_notes: review.requester_notes ?? null,
      allows_rides: review.allows_rides,
      departure_at: dateTimeToIso(review.date, review.departure),
      return_at: dateTimeToIso(review.return_date, review.ret),
      status: "PENDENTE" as const,
    };

    setBusy(true);
    try {
      let tripId = trip?.id ?? null;
      if (trip) {
        const { error } = await supabase.from("trip_requests").update(payload).eq("id", trip.id || "");
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
            driver_user_id: stop.driverUserId,
          })),
        );
        if (stopsError) throw new Error(stopsError.message);

        // Ocupantes: relemos o estado real do banco (os motoristas dos trechos são
        // inseridos automaticamente por gatilho) e aplicamos apenas as diferenças.
        const driverIds = new Set(
          list.map((s) => s.driverUserId).filter(Boolean) as string[],
        );
        // Nomes digitados manualmente (pessoas sem cadastro) usam a mesma
        // estrutura de ocupante externo já existente na tabela.
        const externalNames = chosen
          .filter(isExternalOccupant)
          .map((value) => externalOccupantName(value))
          .filter((name) => name.length > 0);
        const passengerIds = chosen.filter(
          (id) => !isExternalOccupant(id) && !driverIds.has(id),
        );

        const { data: existing } = await supabase
          .from("trip_occupants")
          .select("id, user_id, is_external, is_driver, external_name")
          .eq("trip_id", tripId);

        const current = (existing ?? []).filter((o) => !o.is_external);
        const currentIds = current.map((o) => o.user_id).filter(Boolean) as string[];
        const toRemove = current.filter(
          (o) => o.user_id && !o.is_driver && !passengerIds.includes(o.user_id),
        );
        const toAdd = passengerIds.filter((id) => !currentIds.includes(id));

        const externalRows = (existing ?? []).filter((o) => o.is_external);
        const currentExternal = externalRows.map((o) =>
          (o.external_name ?? "").trim().toLowerCase(),
        );
        const keptExternal = externalNames.map((n) => n.toLowerCase());
        const externalToAdd = externalNames.filter(
          (name) => !currentExternal.includes(name.toLowerCase()),
        );
        // Na edição, externos retirados da lista também são removidos.
        const externalToRemove = trip
          ? externalRows.filter(
              (o) => !keptExternal.includes((o.external_name ?? "").trim().toLowerCase()),
            )
          : [];

        const idsToDelete = [...toRemove, ...externalToRemove].map((o) => o.id);
        if (idsToDelete.length > 0) {
          await supabase.from("trip_occupants").delete().in("id", idsToDelete);
        }

        const rowsToInsert = [
          ...toAdd.map((id) => ({
            trip_id: tripId,
            user_id: id,
            is_external: false,
            external_name: null as string | null,
            added_by: user?.id ?? null,
          })),
          ...externalToAdd.map((name) => ({
            trip_id: tripId,
            user_id: null,
            is_external: true,
            external_name: name,
            added_by: user?.id ?? null,
          })),
        ];
        if (rowsToInsert.length > 0) {
          const { error: occError } = await supabase
            .from("trip_occupants")
            .insert(rowsToInsert);
          // Duplicidade aqui significa que o ocupante já existe: não é erro para o usuário.
          if (occError && !/duplicate key value/i.test(occError.message)) {
            throw new Error(occError.message);
          }
        }



        // Envio de e-mail assíncrono para o setor de transportes
        void notifyEmail({
          data: {
            tripId: tripId,
            requesterName: profile?.full_name || "Servidor SRE",
            sector: profile?.sector || null,
            departureAt: payload.departure_at,
            returnAt: payload.return_at,
            purpose: payload.purpose,
            occupants: chosen,
            stops: list.map(s => ({
              city: cities.find(c => c.id === s.cityId)?.name || s.cityText || null,
              place: places.find(p => p.id === s.destinationId)?.name || s.placeText || null,
              driver_name: people.find(p => p.id === s.driverUserId)?.full_name || null
            }))
          }
        }).catch(err => console.error("Erro ao enviar e-mail de notificação:", err));
      }

      toast.success(
        trip ? "Solicitação atualizada e reenviada à DAFI." : "Solicitação enviada à DAFI.",
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
    const names = selectedOccupants(review.passengers).map((id) =>
      isExternalOccupant(id)
        ? `${externalOccupantName(id)} (externo)`
        : (people.find((p) => p.id === id)?.full_name ?? "—"),
    );

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confira antes de enviar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Data da viagem" value={fmtDate(dateTimeToIso(review.date, review.departure))} />
            <Row
              label="Data de retorno"
              value={fmtDate(dateTimeToIso(review.return_date, review.ret))}
            />
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
            <div>
              <p className="text-muted-foreground">Passageiros ({review.passengers})</p>
              {names.length > 0 ? (
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  {names.map((name, index) => (
                    <li key={index}>{name}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-1 italic">Nenhum passageiro extra</p>
              )}
            </div>
            <Row
              label="Motorista(s)"
              value={
                [...new Set(list.map((s) => s.driverUserId).filter(Boolean))].length > 0
                  ? [...new Set(list.map((s) => s.driverUserId).filter(Boolean))]
                      .map((id) => people.find((p) => p.id === id)?.full_name)
                      .join(", ")
                  : "DAFI DEFINIR"
              }
            />
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
    <form onSubmit={handleReview} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quando</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Data da viagem</Label>
                <Input id="date" name="date" type="date" defaultValue={defaults.date} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="return_date">Data de retorno</Label>
                <Input
                  id="return_date"
                  name="return_date"
                  type="date"
                  defaultValue={defaults.return_date}
                  required
                />
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
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Viagens de vários dias: informe a data de retorno diferente da data da viagem.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Itinerário e Ocupação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <TripStops value={stops} onChange={setStops} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="passengers">Número de passageiros extras</Label>
                  <Input
                    id="passengers"
                    name="passengers"
                    type="number"
                    min={0}
                    max={4}
                    value={passengers}
                    onChange={(e) =>
                      setPassengers(Math.max(0, Math.min(4, Number(e.target.value) || 0)))
                    }
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    O motorista já é contabilizado automaticamente como 1 pessoa. Capacidade: 1 + 4 passageiros.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Ocupação Total do Veículo</Label>
                  <div
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      occupancy.isExceeded
                        ? "border-destructive/20 bg-destructive/5"
                        : "border-info/20 bg-info/5",
                    )}
                  >
                    <div className="flex justify-between font-bold">
                      <span>
                        {occupancy.totalPeople} de {occupancy.capacity} pessoas
                      </span>
                      <span className={occupancy.isExceeded ? "text-destructive" : "text-success"}>
                        {occupancy.isExceeded
                          ? `${occupancy.totalPeople - occupancy.capacity} excedente(s)`
                          : `${occupancy.remaining} vaga(s) restam`}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      (1 motorista + {occupancy.passengersCount} passageiros)
                    </p>
                  </div>
                </div>
              </div>

              <OccupantsPicker
                count={passengers}
                value={occupantIds}
                onChange={setOccupantIds}
                exclude={occupancy.uniqueDriverIds}
                lockedDrivers={occupancy.uniqueDriverIds.map((id) => ({
                  id,
                  label: people.find((p) => p.id === id)?.full_name ?? "Motorista",
                })).map((d) => ({ id: d.id, name: d.label }))}
                allowExternal={canAddExternal}
              />

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
              <CardTitle className="text-base">Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

        <aside>
          <Card className="border-info/40 bg-info/5">
            <CardHeader>
              <CardTitle className="text-base">Como funciona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                A capacidade total é de 5 pessoas (1 motorista + 4 passageiros). O motorista pode
                ser indicado pelo solicitante ou definido pela DAFI.
              </p>
              <p>Você será notificado quando a solicitação for aprovada, ajustada ou recusada.</p>
              <p>O registro oficial no PW/Prodemge é feito pela DAFI após a aprovação.</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="mt-8 border-t pt-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Antes de enviar, revise as informações da sua solicitação.
            </p>
            <p className="text-xs text-muted-foreground">
              Campos obrigatórios serão validados ao prosseguir.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-40"
              onClick={() => void navigate({ to: "/viagens" })}
            >
              Cancelar
            </Button>
            <Button type="submit" className="w-full px-8 sm:w-64" size="lg">
              Revisar e enviar
            </Button>
          </div>
        </div>
      </div>
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
