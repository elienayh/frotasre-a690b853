import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { DriverForm, type DriverRecord } from "@/components/DriverForm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { cnhStatus, DRIVER_TYPE_LABEL, fmtCpf } from "@/lib/motoristas";
import { fmtDate } from "@/lib/frota";

export const Route = createFileRoute("/_authenticated/admin/motoristas/")({
  component: Motoristas,
});

const DRIVER_COLUMNS =
  "id, full_name, cpf, birth_date, phone, mobile, email, address, address_number, complement, district, city, state, zip_code, license_number, license_category, cnh_categories, cnh_issued_at, cnh_expires_at, cnh_first_at, cnh_notes, driver_type, profile_id, is_authorized, is_active, notes";

function Motoristas() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DriverRecord | null>(null);
  const [removing, setRemoving] = useState<DriverRecord | null>(null);
  const [search, setSearch] = useState("");

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select(DRIVER_COLUMNS)
        .order("full_name");
      if (error) throw error;
      return data as unknown as DriverRecord[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drivers;
    return drivers.filter((d) =>
      [d.full_name, d.cpf ?? "", d.license_number ?? "", d.phone ?? "", d.mobile ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [drivers, search]);

  const expiring = useMemo(
    () =>
      drivers.filter((d) => {
        const s = cnhStatus(d.cnh_expires_at);
        return d.is_active && (s.state === "PROXIMA" || s.state === "VENCIDA");
      }),
    [drivers],
  );

  const invalidate = () => void queryClient.invalidateQueries();

  const toggle = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase
        .from("drivers")
        .update({ [field]: value })
        .eq("id", id);
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
    onError: () => {
      toast.error("Motorista com viagens vinculadas. Inative o cadastro em vez de excluir.");
      setRemoving(null);
    },
  });

  return (
    <AppShell
      title="Motoristas e condutores"
      description="Cadastro completo, dados de habilitação e controle de validade da CNH."
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
      {expiring.length > 0 ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Atenção à validade das CNHs</p>
            <p className="text-muted-foreground">
              {expiring.map((d) => `${d.full_name} (${cnhStatus(d.cnh_expires_at).label})`).join(" · ")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 max-w-sm">
        <Label htmlFor="driver-search">Pesquisar</Label>
        <Input
          id="driver-search"
          className="mt-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome, CPF, CNH ou telefone"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhum motorista encontrado.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const cnh = cnhStatus(d.cnh_expires_at);
            return (
              <li key={d.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold">{d.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {DRIVER_TYPE_LABEL[d.driver_type] ?? d.driver_type}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      cnh.tone,
                    )}
                  >
                    {cnh.label}
                  </span>
                </div>

                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">CPF</dt>
                    <dd className="truncate">{fmtCpf(d.cpf)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Contato</dt>
                    <dd className="truncate">{d.mobile || d.phone || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">CNH</dt>
                    <dd className="truncate">
                      {d.license_number || "—"}
                      {d.cnh_categories?.length ? ` · ${d.cnh_categories.join(", ")}` : ""}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Validade</dt>
                    <dd>{d.cnh_expires_at ? fmtDate(`${d.cnh_expires_at}T12:00:00`) : "—"}</dd>
                  </div>
                </dl>

                {!cnh.apt ? (
                  <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                    NÃO APTO PARA CONDUÇÃO — regularize a CNH
                  </p>
                ) : null}

                <div className="mt-4 space-y-2 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`act-${d.id}`} className="text-sm font-normal">
                      Cadastro ativo
                    </Label>
                    <Switch
                      id={`act-${d.id}`}
                      checked={d.is_active}
                      onCheckedChange={(v) =>
                        toggle.mutate({ id: d.id, field: "is_active", value: v })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`auth-${d.id}`} className="text-sm font-normal">
                      Autorizado a dirigir
                    </Label>
                    <Switch
                      id={`auth-${d.id}`}
                      checked={d.is_authorized}
                      onCheckedChange={(v) =>
                        toggle.mutate({ id: d.id, field: "is_authorized", value: v })
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin/motoristas/$driverId" params={{ driverId: d.id }}>
                      <FileText className="mr-1 h-4 w-4" /> Ficha
                    </Link>
                  </Button>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="col-span-2"
                    onClick={() => setRemoving(d)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Excluir
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DriverForm
        open={formOpen}
        driver={editing}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
      />

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir motorista</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.full_name} será removido definitivamente. Se houver viagens vinculadas, a
              exclusão é bloqueada — nesse caso, inative o cadastro.
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

export const driverSchema = z.object({
  full_name: z.string().trim().min(3).max(120),
});
