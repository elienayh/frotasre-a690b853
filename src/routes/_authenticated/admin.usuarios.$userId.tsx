import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronLeft, Mail, Shield, User as UserIcon, History, Route as RouteIcon, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SECTORS } from "@/lib/setores";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuditTimeline } from "@/components/AuditTimeline";
import { fmtDateTime } from "@/lib/frota";
import { StatusBadge } from "@/components/StatusBadge";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/admin/usuarios/$userId")({
  component: UsuarioEdicao,
});

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

function UsuarioEdicao() {
  const { userId } = useParams({ from: "/_authenticated/admin/usuarios/$userId" });
  const queryClient = useQueryClient();
  const { isSuperAdmin, user: currentUser } = useAuth();
  const [sectorDraft, setSectorDraft] = useState<string>("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-detail", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      setSectorDraft(data.sector ?? "");
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles-detail", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      return data.map(r => r.role);
    },
  });

  const { data: trips = [] } = useQuery({
    queryKey: ["profile-trips-detail", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_requests")
        .select("id, code, destination_text, departure_at, return_at, status")
        .eq("requester_id", userId)
        .order("departure_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const patch = useMutation({
    mutationFn: async (values: any) => {
      // Registra alterações relevantes no histórico antes de atualizar
      if (profile) {
        const changes = Object.keys(values).filter(key => (profile as any)[key] !== values[key]);
        for (const key of changes) {
           await supabase.from("permission_history").insert({
             target_user_id: userId,
             actor_id: currentUser?.id ?? null,
             action: "Alteração de dados",
             field_changed: key,
             old_value: String((profile as any)[key]),
             new_value: String(values[key])
           });
        }
      }

      const { error } = await supabase.from("profiles").update(values).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["profile-detail", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ role, grant }: { role: string; grant: boolean }) => {
      const { error } = await supabase.rpc("set_user_role", {
        _user_id: userId,
        _role: role as any,
        _grant: grant,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas.");
      queryClient.invalidateQueries({ queryKey: ["user-roles-detail", userId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetPassword = async () => {
    // Na estrutura do Supabase Auth, o email está na auth.users, mas as tabelas públicas
    // geralmente não têm acesso direto. Se o email não estiver no profile, precisaremos dele.
    const { data: userData, error: userError } = await supabase.auth.getUser(); // Apenas para debug ou se for o próprio usuário
    
    // O ideal é que o profile tenha uma coluna email. Se não tiver, vamos tentar pegar se disponível.
    const targetEmail = (profile as any).email || "";
    
    if (!targetEmail) {
       toast.error("Email do usuário não encontrado no perfil.");
       return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      toast.error("Erro ao enviar e-mail: " + error.message);
    } else {
      toast.success("E-mail de redefinição enviado com sucesso!");
      // Registrar no histórico
      await supabase.from("permission_history").insert({
        target_user_id: userId,
        actor_id: currentUser?.id ?? null,
        action: "Solicitação de redefinição de senha",
      });
    }
  };

  if (isLoading) return <AppShell title="Carregando..."><p>Carregando dados do usuário...</p></AppShell>;
  if (!profile) return <AppShell title="Não encontrado"><p>Usuário não localizado.</p></AppShell>;

  return (
    <AppShell 
      title={`Editar: ${profile.full_name}`} 
      description="Gerencie dados cadastrais, permissões e segurança."
    >
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/admin/usuarios">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar para lista
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="dados" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-2xl h-12">
          <TabsTrigger value="dados" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10"><UserIcon className="mr-2 h-4 w-4" /> Dados</TabsTrigger>
          <TabsTrigger value="permissoes" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10"><Shield className="mr-2 h-4 w-4" /> Permissões</TabsTrigger>
          <TabsTrigger value="seguranca" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10"><Mail className="mr-2 h-4 w-4" /> Segurança</TabsTrigger>
          <TabsTrigger value="viagens" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10"><RouteIcon className="mr-2 h-4 w-4" /> Viagens</TabsTrigger>
          <TabsTrigger value="historico" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10"><History className="mr-2 h-4 w-4" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card className="rounded-[2rem] border-none shadow-xl bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-display text-xl font-black uppercase tracking-tight">Dados do Usuário</CardTitle>
              <CardDescription>Informações básicas e profissionais do servidor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const values = {
                  full_name: formData.get("full_name"),
                  registration: formData.get("registration"),
                  phone: formData.get("phone"),
                  sector: sectorDraft,
                  cpf: formData.get("cpf"),
                };
                patch.mutate(values);
              }} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome Completo</Label>
                  <Input name="full_name" defaultValue={profile.full_name || ""} />
                </div>
                <div className="space-y-2">
                  <Label>Matrícula</Label>
                  <Input name="registration" defaultValue={profile.registration || ""} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail (Login)</Label>
                  <Input defaultValue={(profile as any).email || ""} disabled className="opacity-60" />
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select value={sectorDraft} onValueChange={setSectorDraft}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input name="phone" defaultValue={profile.phone || ""} />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input name="cpf" defaultValue={profile.cpf || ""} />
                </div>
                <div className="sm:col-span-2 pt-4">
                   <Button type="submit" disabled={patch.isPending}>Salvar Alterações</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissoes">
          <Card className="rounded-[2rem] border-none shadow-xl bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-display text-xl font-black uppercase tracking-tight">Funções e Permissões</CardTitle>
              <CardDescription>Atribua papéis administrativos e operacionais ao usuário.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold uppercase tracking-widest">Login Ativo</Label>
                    <p className="text-xs text-muted-foreground">Permite o acesso ao sistema.</p>
                  </div>
                  <Switch 
                    checked={profile.is_active} 
                    onCheckedChange={(v) => patch.mutate({ is_active: v })} 
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold uppercase tracking-widest">Coordenador de Setor</Label>
                    <p className="text-xs text-muted-foreground">Pode gerenciar viagens do setor.</p>
                  </div>
                  <Switch 
                    checked={profile.is_coordinator} 
                    onCheckedChange={(v) => patch.mutate({ is_coordinator: v })} 
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold uppercase tracking-widest">Motorista da SRE</Label>
                    <p className="text-xs text-muted-foreground">Servidor do quadro de motoristas.</p>
                  </div>
                  <Switch 
                    checked={profile.is_sre_driver} 
                    onCheckedChange={(v) => patch.mutate({ is_sre_driver: v })} 
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold uppercase tracking-widest">Credenciado para Dirigir</Label>
                    <p className="text-xs text-muted-foreground">Possui autorização para conduzir.</p>
                  </div>
                  <Switch 
                    checked={profile.is_driver_certified} 
                    onCheckedChange={(v) => patch.mutate({ is_driver_certified: v })} 
                  />
                </div>

                {isSuperAdmin && (
                  <>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold uppercase tracking-widest">Administrador</Label>
                        <p className="text-xs text-muted-foreground">Acesso ao painel administrativo.</p>
                      </div>
                      <Switch 
                        checked={roles.includes("admin")} 
                        onCheckedChange={(v) => setRole.mutate({ role: "admin", grant: v })} 
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold uppercase tracking-widest">Super Admin</Label>
                        <p className="text-xs text-muted-foreground">Acesso total e gestão de permissões.</p>
                      </div>
                      <Switch 
                        checked={roles.includes("super_admin")} 
                        onCheckedChange={(v) => setRole.mutate({ role: "super_admin", grant: v })} 
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguranca">
          <Card className="rounded-[2rem] border-none shadow-xl bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-display text-xl font-black uppercase tracking-tight">Segurança</CardTitle>
              <CardDescription>Gestão de credenciais através do Supabase Auth.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-6 border border-warning/20 bg-warning/5 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-warning" />
                  <p className="font-bold text-sm">Redefinição de Senha</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ao solicitar a redefinição, o usuário receberá um e-mail com um link seguro para definir uma nova senha.
                  O sistema não armazena e nem exibe senhas.
                </p>
                <Button variant="outline" onClick={() => {
                  if (confirm(`Enviar e-mail de redefinição para ${(profile as any).email || "este usuário"}?`)) {
                    resetPassword();
                  }
                }}>
                  <Mail className="mr-2 h-4 w-4" /> Enviar e-mail de redefinição
                </Button>
              </div>

              <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-2xl space-y-4">
                 <div className="flex items-center gap-3">
                  <Trash2 className="h-5 w-5 text-destructive" />
                  <p className="font-bold text-sm">Zona de Perigo</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  A exclusão de um usuário remove permanentemente seus dados do sistema.
                  Esta ação deve ser realizada com cautela e apenas em casos de erro de cadastro.
                </p>
                <Button variant="destructive" onClick={async () => {
                   if (confirm(`Tem certeza que deseja excluir o usuário ${profile.full_name}? Esta ação não pode ser desfeita e pode afetar registros históricos.`)) {
                     const { error } = await supabase.from("profiles").delete().eq("id", userId);
                     if (error) {
                       toast.error("Erro ao excluir: " + error.message);
                     } else {
                       toast.success("Usuário excluído.");
                       navigate({ to: "/admin/usuarios" });
                     }
                   }
                }}>
                  Excluir Usuário
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="viagens">
           <Card className="rounded-[2rem] border-none shadow-xl bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-display text-xl font-black uppercase tracking-tight">Viagens do Usuário</CardTitle>
              <CardDescription>Lista das últimas solicitações realizadas por este servidor.</CardDescription>
            </CardHeader>
            <CardContent>
              {trips.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma viagem encontrada.</p>
              ) : (
                <div className="space-y-4">
                  {trips.map(t => (
                    <div key={t.id} className="p-4 rounded-2xl border border-border/40 bg-muted/20">
                      <div className="flex justify-between items-center">
                        <p className="font-bold">#{t.code} · {t.destination_text}</p>
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {fmtDateTime(t.departure_at)} → {fmtDateTime(t.return_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
           <Card className="rounded-[2rem] border-none shadow-xl bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-display text-xl font-black uppercase tracking-tight">Histórico de Alterações</CardTitle>
              <CardDescription>Registro auditável de permissões e dados.</CardDescription>
            </CardHeader>
            <CardContent>
               <AuditTimeline entityId={userId} entityType="user" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
