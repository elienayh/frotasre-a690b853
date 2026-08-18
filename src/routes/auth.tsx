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

  const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/agenda-publica";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 selection:bg-primary selection:text-primary-foreground">
      {/* Background decorative elements */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-success/5 rounded-full blur-[120px] -z-10" />

      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30"
          >
            <Bus className="h-8 w-8" aria-hidden="true" />
          </motion.div>
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight text-foreground uppercase">Frota SRE</h1>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/70 mt-1">
              Regional de Ensino
            </p>
          </div>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="text-center pb-2 pt-8">
              <CardTitle className="text-xl font-bold tracking-tight">Portal de Acesso</CardTitle>
              <CardDescription className="text-xs font-medium max-w-xs mx-auto">
                Utilize suas credenciais institucionais para gerir solicitações e frota.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-10">
              <Tabs defaultValue="entrar" className="space-y-8">
                <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/30 p-1.5 h-12">
                  <TabsTrigger value="entrar" className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:shadow-lg">Entrar</TabsTrigger>
                  <TabsTrigger value="cadastrar" className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:shadow-lg">Criar Conta</TabsTrigger>
                </TabsList>

                <TabsContent value="entrar" className="mt-0 focus-visible:outline-none">
                  <form onSubmit={handleSignIn} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">E-mail Institucional</Label>
                      <Input id="login-email" name="email" type="email" autoComplete="email" required className="h-12 rounded-xl bg-background/50 border-border/40 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Senha de Acesso</Label>
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="h-12 rounded-xl bg-background/50 border-border/40 focus:ring-primary/20"
                      />
                    </div>
                    <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20" disabled={busy}>
                      {busy ? "Autenticando..." : "Entrar no Sistema"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="cadastrar" className="mt-0 focus-visible:outline-none">
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="su-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</Label>
                      <Input id="su-name" name="full_name" required maxLength={120} className="h-12 rounded-xl bg-background/50 border-border/40" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="su-reg" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Matrícula</Label>
                        <Input id="su-reg" name="registration" maxLength={30} className="h-12 rounded-xl bg-background/50 border-border/40" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="su-sector" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Setor</Label>
                        <Select value={sector} onValueChange={setSector}>
                          <SelectTrigger id="su-sector" className="h-12 rounded-xl bg-background/50 border-border/40">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl">
                            {SECTORS.map((s) => (
                              <SelectItem key={s} value={s} className="rounded-xl font-medium">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">E-mail</Label>
                      <Input id="su-email" name="email" type="email" autoComplete="email" required className="h-12 rounded-xl bg-background/50 border-border/40" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nova Senha</Label>
                      <Input
                        id="su-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={6}
                        className="h-12 rounded-xl bg-background/50 border-border/40"
                      />
                    </div>
                    <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20" disabled={busy}>
                      {busy ? "Processando..." : "Criar Minha Conta"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">
          Superintendência Regional de Ensino
        </p>
      </div>
    </div>
  );
}

