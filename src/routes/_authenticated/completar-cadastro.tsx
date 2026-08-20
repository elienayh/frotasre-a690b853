import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { CheckCircle2, Mail, User as UserIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SECTORS } from "@/lib/setores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/completar-cadastro")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Completar cadastro | Frota SRE" },
      {
        name: "description",
        content:
          "Complete seu cadastro institucional para utilizar o sistema de gestão de frota da SRE Carangola.",
      },
      { property: "og:title", content: "Completar cadastro | Frota SRE" },
      {
        property: "og:description",
        content: "Informe setor, matrícula e contato para concluir seu primeiro acesso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompletarCadastro,
});

/** Campos obrigatórios no primeiro acesso. CNH permanece opcional. */
const schema = z.object({
  full_name: z.string().trim().min(3, "Informe seu nome completo").max(120),
  sector: z.string().trim().min(1, "Selecione o seu setor"),
  registration: z.string().trim().min(1, "Informe sua matrícula").max(30),
  mobile: z.string().trim().min(8, "Informe um telefone de contato").max(30),
  phone: z.string().trim().max(30).optional(),
  cpf: z.string().trim().max(20).optional(),
  birth_date: z.string().trim().optional(),
  cnh_number: z.string().trim().max(30).optional(),
  cnh_categories: z.string().trim().max(40).optional(),
});

function CompletarCadastro() {
  const { user, profile, refresh, loading } = useAuth();
  const navigate = useNavigate();
  const [sector, setSector] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile?.sector) setSector(profile.sector);
  }, [profile?.sector]);

  // Usuários com cadastro já concluído não precisam desta tela.
  useEffect(() => {
    if (!loading && profile?.profile_completed_at) {
      navigate({ to: "/agenda-publica", replace: true });
    }
  }, [loading, profile?.profile_completed_at, navigate]);

  const save = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      if (!user?.id) throw new Error("Sessão expirada. Faça login novamente.");
      const categories = values.cnh_categories
        ? values.cnh_categories
            .split(/[,\s]+/)
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean)
        : [];

      // Somente dados pessoais. Funções e permissões nunca são alteradas aqui.
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          sector: values.sector,
          registration: values.registration,
          mobile: values.mobile,
          phone: values.phone || null,
          cpf: values.cpf || null,
          birth_date: values.birth_date || null,
          cnh_number: values.cnh_number || null,
          ...(categories.length ? { cnh_categories: categories } : {}),
          profile_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Cadastro concluído com sucesso!");
      navigate({ to: "/agenda-publica", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const raw = {
      full_name: String(fd.get("full_name") ?? ""),
      sector,
      registration: String(fd.get("registration") ?? ""),
      mobile: String(fd.get("mobile") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      cpf: String(fd.get("cpf") ?? ""),
      birth_date: String(fd.get("birth_date") ?? ""),
      cnh_number: String(fd.get("cnh_number") ?? ""),
      cnh_categories: String(fd.get("cnh_categories") ?? ""),
    };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] = issue.message;
      }
      setErrors(next);
      toast.error("Verifique os campos obrigatórios.");
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  }

  const fieldError = (name: string) =>
    errors[name] ? <p className="text-xs font-medium text-destructive">{errors[name]}</p> : null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-2xl font-black uppercase tracking-tight text-foreground">
            Completar meu cadastro
          </h1>
          <p className="text-sm text-muted-foreground">
            Precisamos de algumas informações antes do seu primeiro acesso ao sistema.
          </p>
        </div>

        <Card className="rounded-[2rem] border-none bg-card/60 shadow-xl backdrop-blur-md">
          <CardHeader>
            <CardTitle className="font-display text-lg font-black uppercase tracking-tight">
              Identificação institucional
            </CardTitle>
            <CardDescription>Dados recebidos da sua conta Google institucional.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="flex items-center gap-2">
                  <UserIcon className="h-3.5 w-3.5" /> Nome completo
                </Label>
                <Input
                  name="full_name"
                  defaultValue={
                    profile?.full_name ||
                    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
                    ""
                  }
                />
                {fieldError("full_name")}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> E-mail institucional
                </Label>
                <Input value={user?.email ?? ""} disabled className="opacity-70" />
              </div>

              <div className="space-y-2">
                <Label>Setor *</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o seu setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError("sector")}
              </div>

              <div className="space-y-2">
                <Label>Matrícula *</Label>
                <Input name="registration" defaultValue={profile?.registration || ""} />
                {fieldError("registration")}
              </div>

              <div className="space-y-2">
                <Label>Celular / WhatsApp *</Label>
                <Input name="mobile" defaultValue={profile?.mobile || ""} placeholder="(32) 99999-0000" />
                {fieldError("mobile")}
              </div>

              <div className="space-y-2">
                <Label>Telefone institucional</Label>
                <Input name="phone" defaultValue={profile?.phone || ""} />
              </div>

              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <Input type="date" name="birth_date" defaultValue={profile?.birth_date || ""} />
              </div>

              <div className="space-y-2">
                <Label>CPF</Label>
                <Input name="cpf" defaultValue={profile?.cpf || ""} />
              </div>

              <div className="space-y-2">
                <Label>CNH (opcional)</Label>
                <Input name="cnh_number" defaultValue={profile?.cnh_number || ""} />
              </div>

              <div className="space-y-2">
                <Label>Categorias da CNH (opcional)</Label>
                <Input
                  name="cnh_categories"
                  defaultValue={(profile?.cnh_categories ?? []).join(", ")}
                  placeholder="Ex.: AB"
                />
              </div>

              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Informar a CNH não concede automaticamente a função de motorista. O credenciamento é
                feito exclusivamente pela administração.
              </p>

              <div className="sm:col-span-2 pt-2">
                <Button type="submit" disabled={save.isPending} className="w-full rounded-xl gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {save.isPending ? "Salvando..." : "Salvar cadastro"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
