import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Bus, Key, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/redefinir-senha")({
  component: RedefinirSenhaPage,
});

const passwordSchema = z.object({
  password: z.string().min(6, { message: "A senha deve ter ao menos 6 caracteres" }).max(72),
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
  message: "As senhas não conferem",
  path: ["confirm"],
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Escutar por evento de redefinição de senha do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("Fluxo de recuperação de senha iniciado");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = passwordSchema.safeParse({
      password: form.get("password"),
      confirm: form.get("confirm"),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setBusy(false);

    if (error) {
      toast.error("Erro ao atualizar senha: " + error.message);
      return;
    }

    setSuccess(true);
    toast.success("Senha alterada com sucesso!");
    setTimeout(() => navigate({ to: "/auth" }), 3000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl"
          >
            <Bus className="h-8 w-8" />
          </motion.div>
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight text-foreground uppercase">Frota SRE</h1>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/70 mt-1">Recuperação de Acesso</p>
          </div>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-xl rounded-[2rem]">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold tracking-tight">Redefinir Senha</CardTitle>
              <CardDescription>Defina sua nova senha de acesso institucional.</CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-10">
              {success ? (
                <div className="flex flex-col items-center text-center space-y-4 py-4">
                  <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold">Senha alterada com sucesso!</p>
                    <p className="text-sm text-muted-foreground">Você será redirecionado para o login em instantes.</p>
                  </div>
                  <Button variant="ghost" onClick={() => navigate({ to: "/auth" })}>Voltar ao Login agora</Button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nova Senha</Label>
                    <Input name="password" type="password" required className="h-12 rounded-xl bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Confirmar Nova Senha</Label>
                    <Input name="confirm" type="password" required className="h-12 rounded-xl bg-background/50" />
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20" disabled={busy}>
                    {busy ? "Salvando..." : "Salvar Nova Senha"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
