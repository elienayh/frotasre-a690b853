import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { ComboBox } from "@/components/ComboBox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePeople } from "@/hooks/useFrotaOptions";
import { CNH_CATEGORIES, DRIVER_TYPES, DRIVER_TYPE_LABEL } from "@/lib/motoristas";

export interface DriverRecord {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  license_number: string | null;
  license_category: string | null;
  cnh_categories: string[];
  cnh_issued_at: string | null;
  cnh_expires_at: string | null;
  cnh_first_at: string | null;
  cnh_notes: string | null;
  driver_type: string;
  profile_id: string | null;
  is_authorized: boolean;
  is_active: boolean;
  notes: string | null;
}

const schema = z.object({
  full_name: z.string().trim().min(3, { message: "Informe o nome completo" }).max(120),
  cpf: z
    .string()
    .trim()
    .max(14)
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length === 11, { message: "CPF inválido" }),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "E-mail inválido" }),
});

export interface DriverFormProps {
  open: boolean;
  driver: DriverRecord | null;
  onOpenChange: (open: boolean) => void;
}

/** Formulário completo de cadastro/edição de motorista (dados pessoais + CNH). */
export function DriverForm({ open, driver, onOpenChange }: DriverFormProps) {
  const queryClient = useQueryClient();
  const { data: people = [] } = usePeople();
  const [driverType, setDriverType] = useState<string>("SRE");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setDriverType(driver?.driver_type ?? "SRE");
    setProfileId(driver?.profile_id ?? null);
    setCategories(driver?.cnh_categories ?? []);
  }, [open, driver]);

  const peopleOptions = useMemo(
    () => people.map((p) => ({ value: p.id, label: p.full_name, hint: p.sector ?? undefined })),
    [people],
  );

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const parsed = schema.safeParse({
        full_name: form.get("full_name"),
        cpf: String(form.get("cpf") || "") || undefined,
        email: String(form.get("email") || "") || undefined,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos");

      const text = (key: string) => String(form.get(key) || "").trim() || null;
      const values = {
        full_name: parsed.data.full_name,
        cpf: parsed.data.cpf ?? null,
        email: parsed.data.email ?? null,
        birth_date: text("birth_date"),
        phone: text("phone"),
        mobile: text("mobile"),
        address: text("address"),
        address_number: text("address_number"),
        complement: text("complement"),
        district: text("district"),
        city: text("city"),
        state: text("state"),
        zip_code: text("zip_code"),
        license_number: text("license_number"),
        cnh_categories: categories,
        license_category: categories.join(", ") || null,
        cnh_issued_at: text("cnh_issued_at"),
        cnh_expires_at: text("cnh_expires_at"),
        cnh_first_at: text("cnh_first_at"),
        cnh_notes: text("cnh_notes"),
        notes: text("notes"),
        driver_type: driverType,
        profile_id: profileId,
      };

      const { error } = driver
        ? await supabase.from("drivers").update(values).eq("id", driver.id)
        : await supabase.from("drivers").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Motorista salvo.");
      onOpenChange(false);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{driver ? "Editar motorista" : "Novo motorista"}</DialogTitle>
        </DialogHeader>

        <form
          id="driver-form"
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(new FormData(event.currentTarget));
          }}
        >
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Dados pessoais
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="d-name">Nome completo *</Label>
                <Input
                  id="d-name"
                  name="full_name"
                  required
                  maxLength={120}
                  defaultValue={driver?.full_name ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-cpf">CPF</Label>
                <Input id="d-cpf" name="cpf" maxLength={14} defaultValue={driver?.cpf ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-birth">Data de nascimento</Label>
                <Input
                  id="d-birth"
                  name="birth_date"
                  type="date"
                  defaultValue={driver?.birth_date ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-phone">Telefone</Label>
                <Input id="d-phone" name="phone" maxLength={20} defaultValue={driver?.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-mobile">Celular</Label>
                <Input
                  id="d-mobile"
                  name="mobile"
                  maxLength={20}
                  defaultValue={driver?.mobile ?? ""}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="d-email">E-mail</Label>
                <Input
                  id="d-email"
                  name="email"
                  type="email"
                  maxLength={160}
                  defaultValue={driver?.email ?? ""}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="d-address">Endereço</Label>
                <Input
                  id="d-address"
                  name="address"
                  maxLength={160}
                  defaultValue={driver?.address ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-number">Número</Label>
                <Input
                  id="d-number"
                  name="address_number"
                  maxLength={20}
                  defaultValue={driver?.address_number ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-complement">Complemento</Label>
                <Input
                  id="d-complement"
                  name="complement"
                  maxLength={80}
                  defaultValue={driver?.complement ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-district">Bairro</Label>
                <Input
                  id="d-district"
                  name="district"
                  maxLength={80}
                  defaultValue={driver?.district ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-city">Cidade</Label>
                <Input id="d-city" name="city" maxLength={80} defaultValue={driver?.city ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-state">Estado</Label>
                <Input id="d-state" name="state" maxLength={2} defaultValue={driver?.state ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-zip">CEP</Label>
                <Input
                  id="d-zip"
                  name="zip_code"
                  maxLength={9}
                  defaultValue={driver?.zip_code ?? ""}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Carteira Nacional de Habilitação
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="d-cnh">Número da CNH</Label>
                <Input
                  id="d-cnh"
                  name="license_number"
                  maxLength={20}
                  defaultValue={driver?.license_number ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-first">Primeira habilitação</Label>
                <Input
                  id="d-first"
                  name="cnh_first_at"
                  type="date"
                  defaultValue={driver?.cnh_first_at ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-issued">Data de emissão</Label>
                <Input
                  id="d-issued"
                  name="cnh_issued_at"
                  type="date"
                  defaultValue={driver?.cnh_issued_at ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-expires">Data de validade</Label>
                <Input
                  id="d-expires"
                  name="cnh_expires_at"
                  type="date"
                  defaultValue={driver?.cnh_expires_at ?? ""}
                />
              </div>
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="mb-2 text-sm font-medium">Categorias</legend>
                <div className="flex flex-wrap gap-4">
                  {CNH_CATEGORIES.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={categories.includes(c)}
                        onCheckedChange={(checked) =>
                          setCategories((prev) =>
                            checked ? [...prev, c] : prev.filter((v) => v !== c),
                          )
                        }
                        aria-label={`Categoria ${c}`}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="d-cnh-notes">Observações da CNH</Label>
                <Textarea
                  id="d-cnh-notes"
                  name="cnh_notes"
                  rows={2}
                  maxLength={400}
                  defaultValue={driver?.cnh_notes ?? ""}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Vínculo institucional
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="d-type">Tipo</Label>
                <Select value={driverType} onValueChange={setDriverType}>
                  <SelectTrigger id="d-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRIVER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {DRIVER_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-profile">Usuário do sistema (opcional)</Label>
                <ComboBox
                  id="d-profile"
                  options={peopleOptions}
                  value={profileId}
                  onSelect={(option) => setProfileId(option.value)}
                  placeholder="Sem vínculo"
                  searchPlaceholder="Pesquisar usuário…"
                />
                {profileId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setProfileId(null)}
                  >
                    Remover vínculo
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="d-notes">Observações</Label>
                <Textarea
                  id="d-notes"
                  name="notes"
                  rows={2}
                  maxLength={600}
                  defaultValue={driver?.notes ?? ""}
                />
              </div>
            </div>
          </section>
        </form>

        <DialogFooter>
          <Button type="submit" form="driver-form" disabled={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
