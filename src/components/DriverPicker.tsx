import { useMemo } from "react";

import { ComboBox, type ComboOption } from "@/components/ComboBox";
import { usePeople } from "@/hooks/useFrotaOptions";

export interface DriverPickerProps {
  id?: string | undefined;
  /** ID do perfil selecionado como condutor. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Usuário logado, sempre exibido em primeiro lugar. */
  currentUserId?: string | null | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  /** Restringe a lista a usuários ativos marcados como Motorista da SRE. */
  onlySreDrivers?: boolean | undefined;
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
  onlySreDrivers = false,
}: DriverPickerProps) {
  const { data: people = [] } = usePeople();

  const options = useMemo<ComboOption[]>(() => {
    // Somente usuários ativos e credenciados para dirigir podem ser motoristas.
    const eligible = people.filter((p) => p.is_active && p.is_driver_certified);
    const me = eligible.find((p) => p.id === currentUserId);
    const list: ComboOption[] = [];
    if (me && (!onlySreDrivers || me.is_sre_driver)) {
      list.push({ value: me.id, label: me.full_name || "Eu", hint: "Eu · Credenciado", group: "VOCÊ" });
    }
    for (const p of eligible) {
      if (p.id === currentUserId) continue;
      if (!p.is_sre_driver) continue;
      list.push({
        value: p.id,
        label: p.full_name,
        hint: "Motorista da SRE · Credenciado",
        group: "MOTORISTAS DA SRE",
      });
    }
    if (!onlySreDrivers) {
      for (const p of eligible) {
        if (p.id === currentUserId || p.is_sre_driver) continue;
        list.push({
          value: p.id,
          label: p.full_name,
          hint: p.sector ? `${p.sector} · Credenciado` : "Credenciado",
          group: "OUTROS CREDENCIADOS",
        });
      }
    }
    return list;
  }, [people, currentUserId, onlySreDrivers]);



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
