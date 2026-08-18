import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cnhStatus } from "@/lib/motoristas";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosList,
});

interface Profile {
  id: string;
  full_name: string;
  registration: string | null;
  sector: string | null;
  is_active: boolean;
  is_coordinator: boolean;
  is_sre_driver: boolean;
  is_driver_certified: boolean;
  cnh_expires_at: string | null;
}

function UsuariosList() {
  const navigate = useNavigate();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, registration, sector, is_active, is_coordinator, is_sre_driver, is_driver_certified, cnh_expires_at")
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data as { user_id: string; role: string }[];
    },
  });

  const roleOf = (id: string) => roles.filter((r) => r.user_id === id).map((r) => r.role);

  if (isLoading) return <AppShell title="Gestão de Usuários"><p>Carregando...</p></AppShell>;

  return (
    <AppShell title="Gestão de Usuários" description="Clique em um usuário para gerenciar permissões e configurações.">
      <div className="grid gap-4">
        {profiles.map((p) => (
          <Link
            key={p.id}
            to="/admin/usuarios/$userId"
            params={{ userId: p.id }}
            className="group block overflow-hidden rounded-[2rem] border border-border/40 bg-card/60 p-6 backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:border-primary/20 hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-display text-lg font-black tracking-tight text-foreground uppercase">{p.full_name || "Sem nome"}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-lg font-bold uppercase tracking-widest text-[9px]">{p.sector ?? "Sem setor"}</Badge>
                  <span className="text-xs font-medium text-muted-foreground">{p.registration ? `Matrícula ${p.registration}` : "Matrícula não informada"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {p.is_coordinator && <Badge variant="outline" className="rounded-lg font-bold uppercase tracking-widest text-[9px]">Coordenador</Badge>}
                {p.is_sre_driver && <Badge variant="outline" className="rounded-lg font-bold uppercase tracking-widest text-[9px] border-success/30 text-success bg-success/5">Motorista SRE</Badge>}
                {p.is_driver_certified && <Badge variant="outline" className="rounded-lg font-bold uppercase tracking-widest text-[9px]">Credenciado</Badge>}
                {roleOf(p.id).includes("super_admin") && <Badge variant="destructive" className="rounded-lg font-bold uppercase tracking-widest text-[9px]">Super Admin</Badge>}
                {roleOf(p.id).includes("admin") && <Badge variant="secondary" className="rounded-lg font-bold uppercase tracking-widest text-[9px]">Administrador</Badge>}
                {!p.is_active && <Badge variant="destructive" className="rounded-lg font-bold uppercase tracking-widest text-[9px]">Inativo</Badge>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
