import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDateTime } from "@/lib/frota";
import { SECTORS } from "@/lib/setores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: Usuarios,
});

interface ProfileRow {
  id: string;
  full_name: string;
  registration: string | null;
  sector: string | null;
  phone: string | null;
  is_active: boolean;
  is_coordinator: boolean;
  is_sre_driver: boolean;
}

const profileSchema = z.object({
  full_name: z.string().trim().min(3, { message: "Informe o nome" }).max(120),
  registration: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  sector: z.string().trim().max(30).optional(),
});

function Usuarios() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [sectorDraft, setSectorDraft] = useState<string>("");
  const [tripsOf, setTripsOf] = useState<ProfileRow | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, registration, sector, phone, is_active, is_coordinator, is_sre_driver")
        .order("full_name");
      if (error) throw error;
      return data as ProfileRow[];
    },
  });

  const { data: trips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ["profile-trips", tripsOf?.id],
    enabled: Boolean(tripsOf?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select(
          "id, code, destination_text, purpose, departure_at, return_at, status, vehicles(plate, model), drivers(full_name)",
        )
        .eq("requester_id", tripsOf!.id)
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<ProfileRow> }) => {
      const { error } = await supabase.from("profiles").update(values).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profiles-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const parsed = profileSchema.safeParse({
      full_name: form.get("full_name"),
      registration: form.get("registration") || undefined,
      phone: form.get("phone") || undefined,
      sector: sectorDraft || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    patch.mutate(
      {
        id: editing.id,
        values: {
          full_name: parsed.data.full_name,
          registration: parsed.data.registration ?? null,
          phone: parsed.data.phone ?? null,
          sector: parsed.data.sector ?? null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Perfil atualizado.");
          setEditing(null);
        },
      },
    );
  }

  return (
    <AppShell
      title="Usuários"
      description="Acesso, setor, coordenação e viagens de cada servidor cadastrado."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="grid gap-3">
          {profiles.map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.full_name || "Sem nome"}</p>
                    <Badge variant="secondary">{p.sector ?? "Sem setor"}</Badge>
                    {p.is_coordinator ? <Badge>Coordenador</Badge> : null}
                    {p.is_sre_driver ? <Badge variant="outline">Motorista SRE</Badge> : null}
                    {!p.is_active ? <Badge variant="destructive">Inativo</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.registration ? `Matrícula ${p.registration}` : "Matrícula não informada"}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`ativo-${p.id}`} className="text-xs text-muted-foreground">
                      Login ativo
                    </Label>
                    <Switch
                      id={`ativo-${p.id}`}
                      checked={p.is_active}
                      onCheckedChange={(v) => patch.mutate({ id: p.id, values: { is_active: v } })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`coord-${p.id}`} className="text-xs text-muted-foreground">
                      Coordenador
                    </Label>
                    <Switch
                      id={`coord-${p.id}`}
                      disabled={!p.sector}
                      checked={p.is_coordinator}
                      onCheckedChange={(v) =>
                        patch.mutate({ id: p.id, values: { is_coordinator: v } })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`driver-${p.id}`} className="text-xs text-muted-foreground">
                      Motorista da SRE
                    </Label>
                    <Switch
                      id={`driver-${p.id}`}
                      checked={p.is_sre_driver}
                      onCheckedChange={(v) =>
                        patch.mutate({ id: p.id, values: { is_sre_driver: v } })
                      }
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(p);
                      setSectorDraft(p.sector ?? "");
                    }}
                  >
                    <Pencil className="mr-1 h-4 w-4" /> Editar
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setTripsOf(p)}>
                    <RouteIcon className="mr-1 h-4 w-4" /> Viagens
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <form id="profile-form" className="space-y-4" onSubmit={submitEdit}>
            <div className="space-y-2">
              <Label htmlFor="p-name">Nome completo</Label>
              <Input
                id="p-name"
                name="full_name"
                required
                maxLength={120}
                defaultValue={editing?.full_name ?? ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-reg">Matrícula</Label>
                <Input
                  id="p-reg"
                  name="registration"
                  maxLength={30}
                  defaultValue={editing?.registration ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone">Telefone</Label>
                <Input
                  id="p-phone"
                  name="phone"
                  maxLength={30}
                  defaultValue={editing?.phone ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-sector">Setor</Label>
              <Select value={sectorDraft} onValueChange={setSectorDraft}>
                <SelectTrigger id="p-sector">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="profile-form" disabled={patch.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(tripsOf)} onOpenChange={(o) => !o && setTripsOf(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Viagens de {tripsOf?.full_name}</DialogTitle>
          </DialogHeader>
          {loadingTrips ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : trips.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma viagem registrada.</p>
          ) : (
            <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
              {trips.map((t) => (
                <li key={t.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">
                      #{t.code} · {t.destination_text}
                    </p>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fmtDateTime(t.departure_at)} → {fmtDateTime(t.return_at)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t.vehicles ? `${t.vehicles.model} (${t.vehicles.plate})` : "Veículo a definir"}
                    {t.drivers ? ` · ${t.drivers.full_name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
