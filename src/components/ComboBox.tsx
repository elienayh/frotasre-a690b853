import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboOption {
  value: string;
  label: string;
  /** Texto auxiliar exibido abaixo do rótulo. */
  hint?: string;
  /** Grupo em que o item é exibido; a ordem segue a primeira ocorrência. */
  group?: string;
}

export interface ComboBoxProps {
  id?: string;
  options: ComboOption[];
  /** Valor da opção selecionada (id do registro), quando houver. */
  value: string | null;
  /** Texto livre digitado pelo usuário, quando não há registro correspondente. */
  customLabel?: string | null;
  onSelect: (option: ComboOption) => void;
  /** Habilita a criação de um valor digitado manualmente. */
  onCustom?: (text: string) => void;
  customPrefix?: string;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

/** Seletor com pesquisa que aceita, opcionalmente, um valor digitado manualmente. */
export function ComboBox({
  id,
  options,
  value,
  customLabel,
  onSelect,
  onCustom,
  customPrefix = "Usar",
  placeholder,
  searchPlaceholder = "Pesquisar…",
  emptyText = "Nenhum resultado.",
  disabled,
  className,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value) ?? null;
  const display = selected?.label ?? customLabel ?? "";

  const groups = useMemo(() => {
    const map = new Map<string, ComboOption[]>();
    for (const option of options) {
      const key = option.group ?? "";
      const bucket = map.get(key);
      if (bucket) bucket.push(option);
      else map.set(key, [option]);
    }
    return Array.from(map.entries());
  }, [options]);

  const trimmed = query.trim();
  const exact = options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  const showCustom = Boolean(onCustom) && trimmed.length > 1 && !exact;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !display && "text-muted-foreground")}>
            {display || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {showCustom ? null : <CommandEmpty>{emptyText}</CommandEmpty>}
            {showCustom ? (
              <CommandGroup>
                <CommandItem
                  value={`__custom__${trimmed}`}
                  onSelect={() => {
                    onCustom?.(trimmed);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span className="truncate">
                    {customPrefix}: {trimmed}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {groups.map(([group, items]) => (
              <CommandGroup key={group || "default"} heading={group || undefined}>
                {items.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.hint ?? ""}`}
                    onSelect={() => {
                      onSelect(option);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        option.value === value ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.hint ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
