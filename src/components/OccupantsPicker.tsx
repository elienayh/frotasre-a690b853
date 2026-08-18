import { useMemo } from "react";

import { ComboBox, type ComboOption } from "@/components/ComboBox";
import { Label } from "@/components/ui/label";
import { usePeople } from "@/hooks/useFrotaOptions";

export interface OccupantsPickerProps {
  /** Número de ocupantes informado; define quantos campos aparecem. */
  count: number;
  /** IDs escolhidos, na ordem dos campos (null = ainda não escolhido). */
  value: (string | null)[];
  onChange: (value: (string | null)[]) => void;
  /** IDs que não devem aparecer (ex.: já usados em outro contexto). */
  exclude?: string[] | undefined;
}

/**
 * Um campo por ocupante, escolhido entre usuários ativos cadastrados.
 * Impede repetir a mesma pessoa e permite buscar por nome, matrícula ou setor.
 */
export function OccupantsPicker({ count, value, onChange, exclude = [] }: OccupantsPickerProps) {
  const { data: people = [] } = usePeople();

  const slots = useMemo(() => {
    const list = [...value];
    while (list.length < count) list.push(null);
    return list.slice(0, count);
  }, [value, count]);

  const optionsFor = (index: number): ComboOption[] => {
    const taken = new Set(
      [...slots.filter((_, i) => i !== index), ...exclude].filter(Boolean) as string[],
    );
    return people
      .filter((p) => !taken.has(p.id) && (p.is_active !== false)) // Apenas ativos
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

  if (count <= 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label>Ocupantes</Label>
        <span className="text-xs text-muted-foreground">
          {slots.filter(Boolean).length} de {count} selecionado(s)
        </span>
      </div>
      <ol className="space-y-2">
        {slots.map((selected, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-sm text-muted-foreground">{index + 1}.</span>
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
        Todos os ocupantes devem ser escolhidos entre os usuários cadastrados. Ocupantes externos
        são incluídos pela DAFI após o envio.
      </p>
    </div>
  );
}
