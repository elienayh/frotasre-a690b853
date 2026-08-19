import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from "lucide-react";

import { ComboBox, type ComboOption } from "@/components/ComboBox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCities, usePlaces, usePeople } from "@/hooks/useFrotaOptions";
import { useAuth } from "@/hooks/useAuth";

export interface StopValue {
  key: string;
  cityId: string | null;
  cityText: string | null;
  destinationId: string | null;
  placeText: string | null;
  driverUserId: string | null;
}

export function newStop(): StopValue {
  return {
    key: Math.random().toString(36).slice(2),
    cityId: null,
    cityText: null,
    destinationId: null,
    placeText: null,
    driverUserId: null,
  };
}

export interface TripStopsProps {
  value: StopValue[];
  onChange: (stops: StopValue[]) => void;
}

/** Lista de paradas do itinerário: cada parada tem cidade e local próprios. */
export function TripStops({ value, onChange }: TripStopsProps) {
  const { data: cities = [] } = useCities();
  const { data: places = [] } = usePlaces();
  const { data: people = [] } = usePeople();
  const { user, profile } = useAuth();

  const cityOptions: ComboOption[] = cities.map((c) => ({ value: c.id, label: c.name }));

  function update(index: number, patch: Partial<StopValue>) {
    const nextValue = value.map((stop, i) => (i === index ? { ...stop, ...patch } : stop));
    onChange(nextValue);
  }

  function handleAddStop() {
    const lastStop = value[value.length - 1];
    onChange([...value, { ...newStop(), driverUserId: lastStop?.driverUserId || null }]);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {value.map((stop, index) => {
        const cityName = stop.cityId
          ? (cities.find((c) => c.id === stop.cityId)?.name ?? null)
          : stop.cityText;
        const placeOptions: ComboOption[] = places
          .filter((p) => (stop.cityId ? p.city_id === stop.cityId : true))
          .map((p) => ({
            value: p.id,
            label: p.name,
            hint: p.city ?? undefined,
          }));

        return (
          <div key={stop.key} className="rounded-lg border border-border bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                Parada {index + 1}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Mover parada ${index + 1} para cima`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Mover parada ${index + 1} para baixo`}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover parada ${index + 1}`}
                  disabled={value.length === 1}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`city-${stop.key}`}>Cidade</Label>
                <ComboBox
                  id={`city-${stop.key}`}
                  options={cityOptions}
                  value={stop.cityId}
                  customLabel={stop.cityText}
                  placeholder="Selecione uma cidade"
                  searchPlaceholder="Pesquisar ou digitar cidade…"
                  emptyText="Nenhuma cidade encontrada."
                  customPrefix="Outra cidade"
                  onSelect={(option) =>
                    update(index, {
                      cityId: option.value,
                      cityText: null,
                      destinationId: null,
                      placeText: null,
                      driverUserId: stop.driverUserId,
                    })
                  }
                  onCustom={(text) =>
                    update(index, {
                      cityId: null,
                      cityText: text,
                      destinationId: null,
                      placeText: null,
                      driverUserId: stop.driverUserId,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`place-${stop.key}`}>Local de destino</Label>
                <ComboBox
                  id={`place-${stop.key}`}
                  options={placeOptions}
                  value={stop.destinationId}
                  customLabel={stop.placeText}
                  placeholder={
                    cityName ? "Selecione ou digite um local…" : "Escolha a cidade primeiro"
                  }
                  searchPlaceholder="Pesquisar local…"
                  emptyText="Nenhum local cadastrado nesta cidade."
                  customPrefix="Usar novo local"
                  disabled={!cityName}
                  onSelect={(option) =>
                    update(index, { destinationId: option.value, placeText: null })
                  }
                  onCustom={(text) => update(index, { destinationId: null, placeText: text })}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`driver-${stop.key}`}>Motorista</Label>
                <ComboBox
                  id={`driver-${stop.key}`}
                  options={[
                    { value: "DAFI", label: "DAFI DEFINIR" },
                    ...(profile?.is_driver_certified
                      ? [{ value: user?.id || "", label: `EU — ${profile.full_name}` }]
                      : []),
                    ...people
                      .filter((p) => p.is_driver_certified && p.id !== user?.id)
                      .map((p) => ({
                        value: p.id,
                        label: p.full_name,
                        hint: p.sector || undefined,
                      })),
                  ]}
                  value={stop.driverUserId ?? "DAFI"}
                  onSelect={(option) =>
                    update(index, { driverUserId: option.value === "DAFI" ? null : option.value })
                  }
                  placeholder="Selecione o motorista"
                  searchPlaceholder="Pesquisar motorista…"
                  emptyText="Nenhum motorista credenciado encontrado."
                />
                <p className="text-[10px] text-muted-foreground">
                  Selecione um motorista credenciado ou deixe a DAFI definir.
                </p>
              </div>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" onClick={handleAddStop}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar outro destino
      </Button>
    </div>
  );
}

/** Rótulo legível de uma parada, no formato "Local · Cidade". */
export function stopLabel(
  stop: StopValue,
  cityName: string | null,
  placeName: string | null,
): string {
  const place = placeName ?? stop.placeText ?? "";
  const city = cityName ?? stop.cityText ?? "";
  if (place && city) return `${place} · ${city}`;
  return place || city || "Destino não informado";
}
