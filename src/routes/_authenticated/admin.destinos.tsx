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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/destinos")({
  component: Destinos,
});

const schema = z.object({
  name: z.string().trim().min(2, { message: "Informe o destino" }).max(120),
  city: z.string().trim().max(80).optional(),
});

function Destinos() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ["destinations-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("destinations").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
      const { error } = await supabase
        .from("destinations")
        .insert({ name: payload.name, city: payload.city ?? null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Destino cadastrado.");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["destinations-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("destinations").update({ is_active }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["destinations-all"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Destinos"
      description="Locais frequentes disponíveis na solicitação de viagem."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Novo destino
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar destino</DialogTitle>
            </DialogHeader>
            <form
              id="dest-form"
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const parsed = schema.safeParse({
                  name: form.get("name"),
                  city: form.get("city") || undefined,
                });
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
                  return;
                }
                create.mutate(parsed.data);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="dest-name">Nome</Label>
                <Input id="dest-name" name="name" required maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dest-city">Cidade</Label>
                <Input id="dest-city" name="city" maxLength={80} />
              </div>
            </form>
            <DialogFooter>
              <Button type="submit" form="dest-form" disabled={create.isPending}>
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
          {destinations.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="text-sm text-muted-foreground">{d.city ?? "—"}</p>
              </div>
              <Switch
                aria-label={`Ativar ${d.name}`}
                checked={d.is_active}
                onCheckedChange={(v) => toggle.mutate({ id: d.id, is_active: v })}
              />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
