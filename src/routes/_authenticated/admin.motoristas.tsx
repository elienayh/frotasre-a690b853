import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/motoristas")({
  component: Motoristas,
});

const driverSchema = z.object({
  full_name: z.string().trim().min(3, { message: "Informe o nome" }).max(120),
  phone: z.string().trim().max(30).optional(),
  license_number: z.string().trim().max(30).optional(),
  license_category: z.string().trim().max(5).optional(),
});

function Motoristas() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (payload: z.infer<typeof driverSchema>) => {
      const { error } = await supabase.from("drivers").insert({
        full_name: payload.full_name,
        phone: payload.phone ?? null,
        license_number: payload.license_number ?? null,
        license_category: payload.license_category ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Motorista cadastrado.");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("drivers").update({ is_active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["drivers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Motoristas"
      description="Cadastro e disponibilidade dos condutores autorizados."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Novo motorista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar motorista</DialogTitle>
            </DialogHeader>
            <form
              id="driver-form"
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
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
                create.mutate(parsed.data);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="d-name">Nome completo</Label>
                <Input id="d-name" name="full_name" required maxLength={120} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="d-phone">Telefone</Label>
                  <Input id="d-phone" name="phone" maxLength={30} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-cat">Categoria CNH</Label>
                  <Input id="d-cat" name="license_category" maxLength={5} placeholder="AB, D…" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-license">Número da CNH</Label>
                <Input id="d-license" name="license_number" maxLength={30} />
              </div>
            </form>
            <DialogFooter>
              <Button type="submit" form="driver-form" disabled={create.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {drivers.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div>
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
                  onCheckedChange={(v) => toggle.mutate({ id: d.id, is_active: v })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
