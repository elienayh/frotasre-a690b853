import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ComboBox } from "@/components/ComboBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCities } from "@/hooks/useFrotaOptions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

export const Route = createFileRoute("/_authenticated/admin/destinos")({
  component: Destinos,
});

interface DestinationRow {
  id: string;
  name: string;
  city: string | null;
  city_id: string | null;
  address: string | null;
  place_type: string | null;
  is_active: boolean;
}

const schema = z.object({
  name: z.string().trim().min(2, { message: "Informe o nome do local" }).max(160),
  address: z.string().trim().max(200).optional(),
});

const PLACE_TYPES = ["ESCOLA", "ORGAO", "OUTRO"] as const;
const PLACE_TYPE_LABEL: Record<string, string> = {
  ESCOLA: "Escola",
  ORGAO: "Órgão público",
  OUTRO: "Outro",
};

function Destinos() {
  const queryClient = useQueryClient();
  const { data: cities = [] } = useCities(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DestinationRow | null>(null);
  const [removing, setRemoving] = useState<DestinationRow | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [formCityId, setFormCityId] = useState<string | null>(null);
  const [formType, setFormType] = useState<string>("ESCOLA");

  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ["destinations-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("destinations")
        .select("id, name, city, city_id, address, place_type, is_active")
        .order("name");
      if (error) throw error;
      return data as DestinationRow[];
    },
  });

  const filtered = useMemo(
    () =>
      cityFilter === "all"
        ? destinations
        : destinations.filter((d) => d.city_id === cityFilter),
    [destinations, cityFilter],
  );

  const invalidate = () => void queryClient.invalidateQueries();

  const save = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: z.infer<typeof schema> }) => {
      if (!formCityId) throw new Error("Selecione a cidade do local.");
      const cityName = cities.find((c) => c.id === formCityId)?.name ?? null;
      const values = {
        name: payload.name,
        city_id: formCityId,
        city: cityName,
        address: payload.address ?? null,
        place_type: formType,
      };
      const { error } = id
        ? await supabase.from("destinations").update(values).eq("id", id)
        : await supabase.from("destinations").insert(values);
      if (error) {
        throw new Error(
          error.message.includes("duplicate") || error.message.includes("unique")
            ? "Este local já está cadastrado nessa cidade."
            : error.message,
        );
      }
    },
    onSuccess: () => {
      toast.success("Local salvo.");
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("destinations").update({ is_active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("destinations").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Local excluído.");
      setRemoving(null);
      invalidate();
    },
    onError: () =>
      toast.error(
        "Não é possível excluir: o local já foi usado em viagens. Desative-o em vez de excluir.",
      ),
  });

  function openForm(row: DestinationRow | null) {
    setEditing(row);
    setFormCityId(row?.city_id ?? null);
    setFormType(row?.place_type ?? "ESCOLA");
    setFormOpen(true);
  }

  return (
    <AppShell
      title="Locais de destino"
      description="Escolas e órgãos vinculados a cada cidade, usados na solicitação de viagem."
      actions={
        <Button size="sm" onClick={() => openForm(null)}>
          <Plus className="mr-1 h-4 w-4" /> Novo local
        </Button>
      }
    >
      <div className="mb-4 max-w-xs">
        <Label htmlFor="city-filter">Filtrar por cidade</Label>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger id="city-filter" className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cidades</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((d) => (
            <li key={d.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {d.city ?? "—"}
                    {d.place_type ? ` · ${PLACE_TYPE_LABEL[d.place_type] ?? d.place_type}` : ""}
                  </p>
                  {d.address ? (
                    <p className="truncate text-xs text-muted-foreground">{d.address}</p>
                  ) : null}
                </div>
                <Switch
                  aria-label={`Ativar ${d.name}`}
                  checked={d.is_active}
                  onCheckedChange={(v) => toggle.mutate({ id: d.id, is_active: v })}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openForm(d)}>
                  <Pencil className="mr-1 h-4 w-4" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(d)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir
                </Button>
              </div>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nenhum local cadastrado para esta cidade.
            </li>
          ) : null}
        </ul>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar local" : "Cadastrar local"}</DialogTitle>
          </DialogHeader>
          <form
            id="dest-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const parsed = schema.safeParse({
                name: form.get("name"),
                address: form.get("address") || undefined,
              });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
                return;
              }
              save.mutate({ ...(editing ? { id: editing.id } : {}), payload: parsed.data });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="dest-city">Cidade</Label>
              <ComboBox
                id="dest-city"
                options={cities.map((c) => ({ value: c.id, label: c.name }))}
                value={formCityId}
                onSelect={(option) => setFormCityId(option.value)}
                placeholder="Selecione a cidade"
                searchPlaceholder="Pesquisar cidade…"
                emptyText="Cadastre a cidade primeiro."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-name">Nome do local</Label>
              <Input
                id="dest-name"
                name="name"
                required
                maxLength={160}
                defaultValue={editing?.name ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-type">Tipo</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger id="dest-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLACE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PLACE_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-address">Endereço (opcional)</Label>
              <Input
                id="dest-address"
                name="address"
                maxLength={200}
                defaultValue={editing?.address ?? ""}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="dest-form" disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir local</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} será removido definitivamente. Locais já usados em viagens não
              podem ser excluídos — nesse caso, desative o cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && remove.mutate(removing.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
