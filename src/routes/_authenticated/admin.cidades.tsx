import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/admin/cidades")({
  component: Cidades,
});

interface CityRow {
  id: string;
  name: string;
  is_active: boolean;
}

const schema = z.object({
  name: z.string().trim().min(2, { message: "Informe o nome da cidade" }).max(120),
});

function Cidades() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CityRow | null>(null);
  const [removing, setRemoving] = useState<CityRow | null>(null);

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["cities-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, is_active")
        .order("name");
      if (error) throw error;
      return data as CityRow[];
    },
  });

  const invalidate = () => void queryClient.invalidateQueries();

  const save = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: z.infer<typeof schema> }) => {
      const values = { name: payload.name };
      const { error } = id
        ? await supabase.from("cities").update(values).eq("id", id)
        : await supabase.from("cities").insert(values);
      if (error) {
        throw new Error(
          error.message.includes("duplicate") || error.message.includes("unique")
            ? "Já existe uma cidade com esse nome."
            : error.message,
        );
      }
    },
    onSuccess: () => {
      toast.success("Cidade salva.");
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("cities").update({ is_active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cities").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Cidade excluída.");
      setRemoving(null);
      invalidate();
    },
    onError: () =>
      toast.error(
        "Não é possível excluir: a cidade já possui locais ou viagens vinculadas. Desative-a.",
      ),
  });

  return (
    <AppShell
      title="Cidades"
      description="Municípios atendidos pela SRE, usados na solicitação de viagem."
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Nova cidade
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cities.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                </div>
                <Switch
                  aria-label={`Ativar ${c.name}`}
                  checked={c.is_active}
                  onCheckedChange={(v) => toggle.mutate({ id: c.id, is_active: v })}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(c);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="mr-1 h-4 w-4" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(c)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir
                </Button>
              </div>
            </li>
          ))}
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
            <DialogTitle>{editing ? "Editar cidade" : "Cadastrar cidade"}</DialogTitle>
          </DialogHeader>
          <form
            id="city-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const parsed = schema.safeParse({
                name: form.get("name"),
              });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
                return;
              }
              save.mutate({ ...(editing ? { id: editing.id } : {}), payload: parsed.data });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="city-name">Nome</Label>
              <Input
                id="city-name"
                name="name"
                required
                maxLength={120}
                defaultValue={editing?.name ?? ""}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="city-form" disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cidade</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} será removida definitivamente. Cidades com locais ou viagens
              vinculadas não podem ser excluídas — nesse caso, desative o cadastro.
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
