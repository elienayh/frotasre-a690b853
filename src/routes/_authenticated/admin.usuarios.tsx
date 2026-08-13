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
import { cnhStatus } from "@/lib/motoristas";
import { useAuth } from "@/hooks/useAuth";
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
  cpf: string | null;
  birth_date: string | null;
  mobile: string | null;
  cnh_number: string | null;
  cnh_categories: string[] | null;
  cnh_issued_at: string | null;
  cnh_expires_at: string | null;
}

const profileSchema = z.object({
  full_name: z.string().trim().min(3, { message: "Informe o nome" }).max(120),
  registration: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  sector: z.string().trim().max(30).optional(),
  cpf: z.string().trim().max(20).optional(),
  mobile: z.string().trim().max(30).optional(),
  birth_date: z.string().trim().optional(),
  cnh_number: z.string().trim().max(30).optional(),
  cnh_categories: z.string().trim().max(40).optional(),
  cnh_issued_at: z.string().trim().optional(),
  cnh_expires_at: z.string().trim().optional(),
});

function Usuarios() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [sectorDraft, setSectorDraft] = useState<string>("");
  const [tripsOf, setTripsOf] = useState<ProfileRow | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, registration, sector, phone, is_active, is_coordinator, is_sre_driver, cpf, birth_date, mobile, cnh_number, cnh_categories, cnh_issued_at, cnh_expires_at",
        )
        .order("full_name");
      if (error) throw error;
      return data as ProfileRow[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data as { user_id: string; role: string }[];
    },
  });

  const roleOf = (id: string) => roles.filter((r) => r.user_id === id).map((r) => r.role);

  const setRole = useMutation({
    mutationFn: async ({
      userId,
      role,
      grant,
    }: {
      userId: string;
      role: "admin" | "super_admin";
      grant: boolean;
    }) => {
      const { error } = await supabase.rpc("set_user_role", {
        _user_id: userId,
        _role: role,
        _grant: grant,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas.");
      void queryClient.invalidateQueries({ queryKey: ["user-roles-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      cpf: form.get("cpf") || undefined,
      mobile: form.get("mobile") || undefined,
      birth_date: form.get("birth_date") || undefined,
      cnh_number: form.get("cnh_number") || undefined,
      cnh_categories: form.get("cnh_categories") || undefined,
      cnh_issued_at: form.get("cnh_issued_at") || undefined,
      cnh_expires_at: form.get("cnh_expires_at") || undefined,
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
          cpf: parsed.data.cpf ?? null,
          mobile: parsed.data.mobile ?? null,
          birth_date: parsed.data.birth_date || null,
          cnh_number: parsed.data.cnh_number ?? null,
          cnh_categories: parsed.data.cnh_categories
            ? parsed.data.cnh_categories
                .split(/[,\s]+/)
                .map((c) => c.trim().toUpperCase())
                .filter(Boolean)
            : [],
          cnh_issued_at: parsed.data.cnh_issued_at || null,
          cnh_expires_at: parsed.data.cnh_expires_at || null,
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
                    {roleOf(p.id).includes("super_admin") ? <Badge>Super Admin</Badge> : null}
                    {roleOf(p.id).includes("admin") ? (
                      <Badge variant="secondary">Administrador</Badge>
                    ) : null}
                    {p.is_sre_driver && p.cnh_expires_at ? (
                      <Badge variant="outline" className={cnhStatus(p.cnh_expires_at).tone}>
                        {cnhStatus(p.cnh_expires_at).label}
                      </Badge>
                    ) : null}
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
                  {isSuperAdmin ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`adm-${p.id}`} className="text-xs text-muted-foreground">
                          Administrador
                        </Label>
                        <Switch
                          id={`adm-${p.id}`}
                          checked={roleOf(p.id).includes("admin")}
                          onCheckedChange={(v) =>
                            setRole.mutate({ userId: p.id, role: "admin", grant: v })
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`sadm-${p.id}`} className="text-xs text-muted-foreground">
                          Super Admin
                        </Label>
                        <Switch
                          id={`sadm-${p.id}`}
                          checked={roleOf(p.id).includes("super_admin")}
                          onCheckedChange={(v) =>
                            setRole.mutate({ userId: p.id, role: "super_admin", grant: v })
                          }
                        />
                      </div>
                    </>
                  ) : null}
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-cpf">CPF</Label>
                <Input id="p-cpf" name="cpf" maxLength={20} defaultValue={editing?.cpf ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-mobile">Celular</Label>
                <Input
                  id="p-mobile"
                  name="mobile"
                  maxLength={30}
                  defaultValue={editing?.mobile ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-birth">Data de nascimento</Label>
                <Input
                  id="p-birth"
                  name="birth_date"
                  type="date"
                  defaultValue={editing?.birth_date ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cnh">Número da CNH</Label>
                <Input
                  id="p-cnh"
                  name="cnh_number"
                  maxLength={30}
                  defaultValue={editing?.cnh_number ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cats">Categorias da CNH</Label>
                <Input
                  id="p-cats"
                  name="cnh_categories"
                  placeholder="Ex.: AB, D"
                  defaultValue={(editing?.cnh_categories ?? []).join(", ")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cnh-exp">Validade da CNH</Label>
                <Input
                  id="p-cnh-exp"
                  name="cnh_expires_at"
                  type="date"
                  defaultValue={editing?.cnh_expires_at ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cnh-iss">Emissão da CNH</Label>
                <Input
                  id="p-cnh-iss"
                  name="cnh_issued_at"
                  type="date"
                  defaultValue={editing?.cnh_issued_at ?? ""}
                />
              </div>
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
