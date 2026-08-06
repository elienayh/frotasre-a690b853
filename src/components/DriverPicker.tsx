import { useMemo } from "react";

import { ComboBox, type ComboOption } from "@/components/ComboBox";
import { usePeople } from "@/hooks/useFrotaOptions";

export interface DriverPickerProps {
  id?: string;
  /** ID do perfil selecionado como condutor. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Usuário logado, sempre exibido em primeiro lugar. */
  currentUserId?: string | null;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Seletor de condutor com a ordem exigida pela SRE:
 * 1) usuário logado, 2) motoristas oficiais, 3) demais usuários ativos.
 */
export function DriverPicker({
  id,
  value,
  onChange,
  currentUserId,
  placeholder = "Selecione quem irá dirigir",
  disabled,
}: DriverPickerProps) {
  const { data: people = [] } = usePeople();

  const options = useMemo<ComboOption[]>(() => {
    const me = people.find((p) => p.id === currentUserId);
    const list: ComboOption[] = [];
    if (me) {
      list.push({ value: me.id, label: me.full_name || "Eu", hint: "Eu", group: "VOCÊ" });
    }
    for (const p of people) {
      if (p.id === currentUserId) continue;
      if (!p.is_sre_driver) continue;
      list.push({
        value: p.id,
        label: p.full_name,
        hint: "Motorista da SRE",
        group: "MOTORISTAS DA SRE",
      });
    }
    for (const p of people) {
      if (p.id === currentUserId || p.is_sre_driver) continue;
      list.push({
        value: p.id,
        label: p.full_name,
        hint: p.sector ?? undefined,
        group: "OUTROS USUÁRIOS",
      });
    }
    return list;
  }, [people, currentUserId]);

  return (
    <ComboBox
      id={id}
      options={options}
      value={value}
      onSelect={(option) => onChange(option.value)}
      placeholder={placeholder}
      searchPlaceholder="Pesquisar pessoa…"
      emptyText="Nenhum usuário encontrado."
      disabled={disabled}
    />
  );
}
