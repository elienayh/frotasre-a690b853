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
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/admin/motoristas")({
  component: Motoristas,
});

interface DriverRow {
  id: string;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  license_category: string | null;
  is_active: boolean;
  is_authorized: boolean;
}

const driverSchema = z.object({
  full_name: z.string().trim().min(3, { message: "Informe o nome" }).max(120),
  phone: z.string().trim().max(30).optional(),
  license_number: z.string().trim().max(30).optional(),
  license_category: z.string().trim().max(5).optional(),
});

type DriverInput = z.infer<typeof driverSchema>;

function Motoristas() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DriverRow | null>(null);
  const [removing, setRemoving] = useState<DriverRow | null>(null);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").order("full_name");
      if (error) throw error;
      return data as DriverRow[];
    },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["drivers"] });

  const save = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: DriverInput }) => {
      const values = {
        full_name: payload.full_name,
        phone: payload.phone ?? null,
        license_number: payload.license_number ?? null,
        license_category: payload.license_category ?? null,
      };
      const { error } = id
        ? await supabase.from("drivers").update(values).eq("id", id)
        : await supabase.from("drivers").insert(values);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Motorista salvo.");
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<DriverRow> }) => {
      const { error } = await supabase.from("drivers").update(values).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Motorista excluído.");
      setRemoving(null);
      invalidate();
    },
    onError: () =>
      toast.error(
        "Não é possível excluir: o motorista já está vinculado a viagens. Desative-o em vez de excluir.",
      ),
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = driverSchema.safeParse({
      full_name: form.get("full_name"),
      phone: form.get("phone") || undefined,
      license_number: form.get("license_number") || undefined,
      license_category: form.get("license_category") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    save.mutate({ ...(editing ? { id: editing.id } : {}), payload: parsed.data });
  }

  return (
    <AppShell
      title="Motoristas"
      description="Cadastro, edição e disponibilidade dos condutores autorizados."
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo motorista
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {drivers.map((d) => (
            <li key={d.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{d.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {d.license_category ? `CNH ${d.license_category}` : "CNH não informada"}
                    {d.phone ? ` · ${d.phone}` : ""}
                  </p>
                  {!d.is_authorized ? (
                    <Badge variant="destructive" className="mt-2">
                      Não autorizado
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`ativo-${d.id}`} className="text-xs text-muted-foreground">
                    Ativo
                  </Label>
                  <Switch
                    id={`ativo-${d.id}`}
                    checked={d.is_active}
                    onCheckedChange={(v) => patch.mutate({ id: d.id, values: { is_active: v } })}
                  />
                </div>
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
            <DialogTitle>{editing ? "Editar motorista" : "Cadastrar motorista"}</DialogTitle>
          </DialogHeader>
          <form id="driver-form" className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="d-name">Nome completo</Label>
              <Input
                id="d-name"
                name="full_name"
                required
                maxLength={120}
                defaultValue={editing?.full_name ?? ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="d-phone">Telefone</Label>
                <Input
                  id="d-phone"
                  name="phone"
                  maxLength={30}
                  defaultValue={editing?.phone ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-cat">Categoria CNH</Label>
                <Input
                  id="d-cat"
                  name="license_category"
                  maxLength={5}
                  placeholder="AB, D…"
                  defaultValue={editing?.license_category ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-license">Número da CNH</Label>
              <Input
                id="d-license"
                name="license_number"
                maxLength={30}
                defaultValue={editing?.license_number ?? ""}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="driver-form" disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir motorista</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.full_name} será removido definitivamente. Motoristas já vinculados a
              viagens não podem ser excluídos — nesse caso, desative o cadastro.
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
