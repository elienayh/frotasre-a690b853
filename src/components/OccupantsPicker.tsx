import { useMemo } from "react";
import { Lock, CarFront } from "lucide-react";

import { ComboBox, type ComboOption } from "@/components/ComboBox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { usePeople } from "@/hooks/useFrotaOptions";
import { EXTERNAL_PREFIX, externalOccupantName, isExternalOccupant } from "@/lib/occupancy";


/** Motorista já definido em um trecho: ocupa vaga automaticamente e não é editável aqui. */
export interface LockedDriver {
  id: string;
  name: string;
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
}: OccupantsPickerProps) {

  const { data: people = [] } = usePeople();

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
          <li key={driver.id} className="flex items-center gap-2">
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
          </li>
        ))}
        {slots.map((selected, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-sm text-muted-foreground">
              {lockedDrivers.length + index + 1}.
            </span>
            <div className="min-w-0 flex-1">
              <ComboBox
                options={optionsFor(index)}
                value={selected}
                onSelect={(option) => setSlot(index, option.value)}
                placeholder="Selecionar usuário"
                searchPlaceholder="Buscar por nome, matrícula ou setor…"
                emptyText="Nenhum usuário encontrado."
              />
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        O motorista é incluído automaticamente e só pode ser alterado no campo “Motorista” do
        destino. Ocupantes externos são incluídos pela DAFI após o envio.
      </p>
    </div>
  );
}
