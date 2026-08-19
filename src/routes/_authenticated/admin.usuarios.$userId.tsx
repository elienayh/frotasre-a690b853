import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getUserEmail, deleteUserAccount } from "@/integrations/supabase/admin.functions";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperAdmin, user: currentUser } = useAuth();
  const [sectorDraft, setSectorDraft] = useState<string>("");
  const fetchEmail = useServerFn(getUserEmail);
  const deleteAccount = useServerFn(deleteUserAccount);

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


  if (isLoading) return <AppShell title="Carregando..." description="Buscando dados no servidor..."><div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div></AppShell>;
  if (!profile) return (
    <AppShell title="Não encontrado" description="Usuário não localizado no sistema.">
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card/20 rounded-[2rem] border border-dashed border-border/60">
        <h3 className="font-display text-lg font-bold text-foreground uppercase tracking-tight">Usuário não encontrado</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-6">O ID informado não corresponde a nenhum perfil ativo.</p>
        <Button variant="outline" asChild className="rounded-xl">
          <Link to="/admin/usuarios">
            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar para usuários
          </Link>
        </Button>
      </div>
    </AppShell>
  );


  return (
    <AppShell 
      title={`Editar: ${profile.full_name}`} 
      description="Gerencie dados cadastrais, permissões e segurança."
    >
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 rounded-xl hover:bg-accent/80 group">
          <Link to="/admin/usuarios">
            <ChevronLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span className="font-bold uppercase tracking-widest text-[10px]">Voltar para a lista de usuários</span>
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="dados" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-2xl h-12">
          <TabsTrigger value="dados" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10"><UserIcon className="mr-2 h-4 w-4" /> Dados</TabsTrigger>
          <TabsTrigger value="permissoes" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10"><Shield className="mr-2 h-4 w-4" /> Permissões</TabsTrigger>
          <TabsTrigger value="identidade" className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-10"><Shield className="mr-2 h-4 w-4" /> Identidade Google</TabsTrigger>
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
                  mobile: formData.get("mobile"),
                  address: formData.get("address"),
                  cnh_number: formData.get("cnh_number"),
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
                  <Label>ID do Usuário (UUID)</Label>
                  <Input defaultValue={profile.id} disabled className="opacity-60 font-mono text-[10px]" />
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
                <div className="space-y-2">
                  <Label>Celular / WhatsApp</Label>
                  <Input name="mobile" defaultValue={profile.mobile || ""} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Endereço Completo</Label>
                  <Input name="address" defaultValue={profile.address || ""} placeholder="Rua, Número, Bairro, Cidade - UF" />
                </div>
                <div className="space-y-2">
                  <Label>Número da CNH</Label>
                  <Input name="cnh_number" defaultValue={profile.cnh_number || ""} />
                </div>
                <div className="sm:col-span-2 pt-4">
                   <Button type="submit" disabled={patch.isPending} className="w-full sm:w-auto rounded-xl">Salvar Alterações</Button>
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

        <TabsContent value="identidade">
          <Card className="rounded-[2rem] border-none shadow-xl bg-card/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-display text-xl font-black uppercase tracking-tight">Identidade Institucional</CardTitle>
              <CardDescription>Gestão da conta institucional vinculada via Google OAuth.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-6 border border-primary/20 bg-primary/5 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <p className="font-bold text-sm">Conta Autenticada</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">E-mail do Google</p>
                  <p className="text-lg font-bold">{profile.full_name ? profile.full_name : "Carregando..."}</p>
                  <p className="text-sm font-medium opacity-70">O login agora é feito exclusivamente via Google Institucional.</p>
                </div>
                
                <div className="pt-2">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    Domínio Validado: @educacao.mg.gov.br
                  </Badge>
                </div>
              </div>

              <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-2xl space-y-4">
                 <div className="flex items-center gap-3">
                  <Trash2 className="h-5 w-5 text-destructive" />
                  <p className="font-bold text-sm">Zona de Perigo</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  A exclusão de um usuário remove permanentemente seus dados do sistema e seu acesso ao Auth.
                  Esta ação deve ser realizada com cautela.
                </p>
                <Button 
                  variant="destructive" 
                  disabled={!isSuperAdmin}
                  onClick={async () => {
                   if (confirm(`TEM CERTEZA ABSOLUTA? Isso excluirá o acesso de ${profile.full_name} permanentemente.`)) {

                     try {
                       await deleteAccount({ data: { userId } });
                       toast.success("Usuário excluído do sistema e do Auth.");
                       navigate({ to: "/admin/usuarios" });
                     } catch (err: any) {
                       toast.error("Erro ao excluir: " + err.message);
                     }
                   }
                }}>
                  Excluir Usuário (Auth + Dados)
                </Button>
                {!isSuperAdmin && (
                  <p className="text-[10px] text-destructive italic">Apenas Super Admins podem realizar a exclusão física.</p>
                )}
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
