import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTORS } from "@/lib/setores";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar — Frota SRE" },
      {
        name: "description",
        content: "Acesse o Frota SRE para solicitar viagens e acompanhar a agenda da frota oficial.",
      },
      { property: "og:title", content: "Entrar — Frota SRE" },
      {
        property: "og:description",
        content: "Acesso dos servidores e da DAFI ao sistema interno de viagens.",
      },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email({ message: "Informe um e-mail válido" }).max(255),
  password: z.string().min(6, { message: "A senha deve ter ao menos 6 caracteres" }).max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sector, setSector] = useState<string>("");

  const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/painel";

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: target, replace: true });
    }
  }, [loading, session, navigate, target]);

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = credentialsSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível entrar. Verifique e-mail e senha.");
      return;
    }
    void navigate({ to: target, replace: true });
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = credentialsSchema
      .extend({
        full_name: z.string().trim().min(3, { message: "Informe seu nome completo" }).max(120),
        registration: z.string().trim().max(30).optional(),
        sector: z.string().trim().max(30).optional(),
      })
      .safeParse({
        email: form.get("email"),
        password: form.get("password"),
        full_name: form.get("full_name"),
        registration: form.get("registration") || undefined,
        sector: sector || undefined,
      });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.full_name,
          registration: parsed.data.registration ?? null,
          sector: parsed.data.sector ?? null,
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      void navigate({ to: target, replace: true });
    } else {
      toast.success("Cadastro criado. Confirme o e-mail para acessar o sistema.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Bus className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-xl font-bold text-sidebar-foreground">Frota SRE</p>
            <p className="text-sm text-sidebar-foreground/60">
              Solicitação e gestão de viagens oficiais
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Acesso ao sistema</CardTitle>
            <CardDescription>
              Use seu e-mail institucional. O registro oficial no PW/Prodemge continua sendo feito
              pela DAFI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="entrar">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="cadastrar">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="entrar">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input id="login-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Entrando…" : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="cadastrar">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Nome completo</Label>
                    <Input id="su-name" name="full_name" required maxLength={120} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="su-reg">Matrícula</Label>
                      <Input id="su-reg" name="registration" maxLength={30} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-sector">Setor</Label>
                      <Select value={sector} onValueChange={setSector}>
                        <SelectTrigger id="su-sector">
                          <SelectValue placeholder="Selecione" />
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">E-mail</Label>
                    <Input id="su-email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Senha</Label>
                    <Input
                      id="su-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Criando…" : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
