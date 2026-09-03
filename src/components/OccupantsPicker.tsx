import { useMemo } from "react";
import { Lock, CarFront, Plus, X } from "lucide-react";

import { ComboBox, type ComboOption } from "@/components/ComboBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePeople, usePlaces } from "@/hooks/useFrotaOptions";
import { EXTERNAL_PREFIX, externalOccupantName, isExternalOccupant } from "@/lib/occupancy";


/** Motorista já definido em um trecho: ocupa vaga automaticamente e não é editável aqui. */
export interface LockedDriver {
  id: string;
  name: string;
}

/**
 * Destino individual escolhido para um ocupante no formulário de solicitação.
 * `destinationId` referencia um destino já cadastrado; `name` é um local novo
 * digitado pelo usuário (cadastrado automaticamente no envio).
 */
export interface OccupantDestPick {
  destinationId?: string | null;
  name?: string | null;
}

export interface OccupantsPickerProps {
  /** Número de passageiros adicionais; define quantos campos editáveis aparecem. */
  count: number;
  /** IDs escolhidos, na ordem dos campos (null = ainda não escolhido). */
  value: (string | null)[];
  onChange: (value: (string | null)[]) => void;
  /** IDs que não devem aparecer (ex.: já usados em outro contexto). */
  exclude?: string[] | undefined;
  /** Motoristas definidos nos trechos, exibidos como posições bloqueadas. */
  lockedDrivers?: LockedDriver[] | undefined;
  /**
   * Permite registrar uma pessoa sem cadastro (ocupante externo) digitando o
   * nome. Disponível apenas para motoristas credenciados e administradores.
   */
  allowExternal?: boolean | undefined;
  /**
   * Destinos individuais por ocupante, indexados pela chave do ocupante
   * (id do usuário ou `ext:Nome` para externos). Quando informado, cada
   * ocupante selecionado exibe o editor de destinos.
   */
  destinations?: Record<string, OccupantDestPick[]> | undefined;
  onDestinationsChange?: ((next: Record<string, OccupantDestPick[]>) => void) | undefined;
}

/** Editor de destinos individuais de um ocupante (um ou mais locais por pessoa). */
function OccupantDestinationsEditor({
  occupantKey,
  picks,
  options,
  onChange,
}: {
  occupantKey: string;
  picks: OccupantDestPick[];
  options: ComboOption[];
  onChange: (occupantKey: string, picks: OccupantDestPick[]) => void;
}) {
  // Sempre existe pelo menos um campo vazio para escolher o primeiro destino.
  const rows = picks.length > 0 ? picks : [{}];

  function setPick(index: number, pick: OccupantDestPick) {
    const base = picks.length > 0 ? [...picks] : [{}];
    base[index] = pick;
    onChange(occupantKey, base.filter((p) => p.destinationId || p.name));
  }

  function removePick(index: number) {
    onChange(
      occupantKey,
      picks.filter((_, i) => i !== index),
    );
  }

  function addPick() {
    onChange(occupantKey, [...picks, {}]);
  }

  return (
    <div className="space-y-1.5 pl-7">
      {rows.map((pick, index) => {
        const isDraft = index >= picks.length;
        const value = pick.destinationId ?? null;
        const customLabel = pick.name ?? null;
        // Um campo "rascunho" vazio ao final só aparece depois que o anterior foi preenchido.
        if (isDraft && !picks[picks.length - 1]?.destinationId && !picks[picks.length - 1]?.name) {
          return null;
        }
        return (
          <div key={index} className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <ComboBox
                options={options}
                value={value}
                customLabel={customLabel}
                onSelect={(option) => setPick(index, { destinationId: option.value })}
                onCustom={(text) => setPick(index, { name: text })}
                customPrefix="Cadastrar destino"
                placeholder="Destino do passageiro…"
                searchPlaceholder="Nome do local…"
                emptyText="Nenhum local encontrado."
              />
            </div>
            {!isDraft && picks.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remover destino"
                onClick={() => removePick(index)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            {index === rows.length - 1 && (pick.destinationId || pick.name) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Adicionar outro destino"
                onClick={addPick}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Um campo por passageiro adicional, escolhido entre usuários ativos cadastrados.
 * Os motoristas definidos nos trechos aparecem como posições bloqueadas no topo.
 */
export function OccupantsPicker({
  count,
  value,
  onChange,
  exclude = [],
  lockedDrivers = [],
  allowExternal = false,
  destinations,
  onDestinationsChange,
}: OccupantsPickerProps) {

  const { data: people = [] } = usePeople();
  const { data: places = [] } = usePlaces();

  const placeOptions: ComboOption[] = useMemo(
    () => places.map((p) => ({ value: p.id, label: p.name, hint: p.city ?? undefined })),
    [places],
  );

  const slots = useMemo(() => {
    const list = [...value];
    while (list.length < count) list.push(null);
    return list.slice(0, count);
  }, [value, count]);

  const optionsFor = (index: number): ComboOption[] => {
    const taken = new Set(
      [
        ...slots.filter((_, i) => i !== index),
        ...exclude,
        ...lockedDrivers.map((d) => d.id),
      ].filter(Boolean) as string[],
    );
    return people
      .filter((p) => !taken.has(p.id) && p.is_active !== false)
      .map((p) => ({
        value: p.id,
        label: p.full_name,
        hint: [p.sector, p.registration].filter(Boolean).join(" · ") || undefined,
        ...(p.sector ? { group: p.sector } : {}),
      }));
  };

  function setSlot(index: number, id: string | null) {
    const next = [...slots];
    next[index] = id;
    onChange(next);
  }

  function setDestinations(occupantKey: string, picks: OccupantDestPick[]) {
    if (!onDestinationsChange) return;
    onDestinationsChange({ ...(destinations ?? {}), [occupantKey]: picks });
  }

  const showDestinations = Boolean(onDestinationsChange);

  if (count <= 0 && lockedDrivers.length === 0) return null;

  const totalSelected = lockedDrivers.length + slots.filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label>Ocupantes</Label>
        <span className="text-xs text-muted-foreground">
          {totalSelected} de {lockedDrivers.length + count} pessoa(s)
        </span>
      </div>
      <ol className="space-y-2">
        {lockedDrivers.map((driver, index) => (
          <li key={driver.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-sm text-muted-foreground">{index + 1}.</span>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <CarFront className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate text-sm font-semibold">{driver.name}</span>
                  <Badge
                    variant="secondary"
                    className="h-4 border-primary/20 bg-primary/10 px-1 py-0 text-[9px] font-black uppercase tracking-widest text-primary"
                  >
                    Motorista
                  </Badge>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <Lock className="h-3 w-3" aria-hidden="true" /> Definido no campo “Motorista”
                </span>
              </div>
            </div>
            {showDestinations && (
              <OccupantDestinationsEditor
                occupantKey={driver.id}
                picks={destinations?.[driver.id] ?? []}
                options={placeOptions}
                onChange={setDestinations}
              />
            )}
          </li>
        ))}
        {slots.map((selected, index) => {
          const external = isExternalOccupant(selected);
          return (
            <li key={index} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-sm text-muted-foreground">
                  {lockedDrivers.length + index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <ComboBox
                    options={optionsFor(index)}
                    value={external ? null : selected}
                    customLabel={external ? externalOccupantName(selected!) : null}
                    onSelect={(option) => setSlot(index, option.value)}

                    {...(allowExternal
                      ? {
                          onCustom: (text: string) =>
                            setSlot(index, `${EXTERNAL_PREFIX}${text}`),
                          customPrefix: "Adicionar ocupante externo",
                        }
                      : {})}
                    placeholder="Selecionar usuário"
                    searchPlaceholder={
                      allowExternal
                        ? "Buscar usuário ou digitar nome do externo…"
                        : "Buscar por nome, matrícula ou setor…"
                    }
                    emptyText="Nenhum usuário encontrado."
                  />
                </div>
                {external ? (
                  <Badge
                    variant="secondary"
                    className="h-5 shrink-0 px-1.5 text-[9px] font-black uppercase tracking-widest"
                  >
                    Externo
                  </Badge>
                ) : null}
              </div>
              {showDestinations && selected && (
                <OccupantDestinationsEditor
                  occupantKey={selected}
                  picks={destinations?.[selected] ?? []}
                  options={placeOptions}
                  onChange={setDestinations}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        O motorista é incluído automaticamente e só pode ser alterado no campo “Motorista” do
        destino.{" "}
        {allowExternal
          ? "Se a pessoa não tiver cadastro, digite o nome e escolha “Adicionar ocupante externo”."
          : "Ocupantes externos são incluídos pela DAFI após o envio."}
        {showDestinations
          ? " Opcionalmente, informe o(s) destino(s) de cada pessoa; locais novos são cadastrados automaticamente."
          : ""}
      </p>
    </div>
  );
}
