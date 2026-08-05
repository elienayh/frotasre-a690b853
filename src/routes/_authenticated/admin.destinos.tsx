import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export const Route = createFileRoute("/_authenticated/admin/destinos")({
  component: Destinos,
});

interface DestinationRow {
  id: string;
  name: string;
  city: string | null;
  is_active: boolean;
}

const schema = z.object({
  name: z.string().trim().min(2, { message: "Informe o destino" }).max(120),
  city: z.string().trim().max(80).optional(),
});

type DestinationInput = z.infer<typeof schema>;

function Destinos() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DestinationRow | null>(null);
  const [removing, setRemoving] = useState<DestinationRow | null>(null);

  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ["destinations-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("destinations").select("*").order("name");
      if (error) throw error;
      return data as DestinationRow[];
    },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["destinations-all"] });

  const save = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: DestinationInput }) => {
      const values = { name: payload.name, city: payload.city ?? null };
      const { error } = id
        ? await supabase.from("destinations").update(values).eq("id", id)
        : await supabase.from("destinations").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Destino salvo.");
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
      toast.success("Destino excluído.");
      setRemoving(null);
      invalidate();
    },
    onError: () =>
      toast.error(
        "Não é possível excluir: o destino já foi usado em viagens. Desative-o em vez de excluir.",
      ),
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      name: form.get("name"),
      city: form.get("city") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    save.mutate({ ...(editing ? { id: editing.id } : {}), payload: parsed.data });
  }

  return (
    <AppShell
      title="Destinos"
      description="Locais frequentes disponíveis na solicitação de viagem."
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo destino
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {destinations.map((d) => (
            <li key={d.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-sm text-muted-foreground">{d.city ?? "—"}</p>
                </div>
                <Switch
                  aria-label={`Ativar ${d.name}`}
                  checked={d.is_active}
                  onCheckedChange={(v) => toggle.mutate({ id: d.id, is_active: v })}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(d);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="mr-1 h-4 w-4" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(d)}>
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
            <DialogTitle>{editing ? "Editar destino" : "Cadastrar destino"}</DialogTitle>
          </DialogHeader>
          <form id="dest-form" className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="dest-name">Nome</Label>
              <Input
                id="dest-name"
                name="name"
                required
                maxLength={120}
                defaultValue={editing?.name ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dest-city">Cidade</Label>
              <Input
                id="dest-city"
                name="city"
                maxLength={80}
                defaultValue={editing?.city ?? ""}
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
            <AlertDialogTitle>Excluir destino</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} será removido definitivamente. Destinos já usados em viagens não
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
