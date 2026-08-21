import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const handleAuthCallback = async () => {
      // Pequeno delay para garantir que o hash (#) seja processado pelo cliente Supabase
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data, error } = await supabase.auth.getSession();
      
      if (!mounted) return;

      if (error) {
        console.error("Erro no callback de autenticação:", error);
        toast.error("Erro ao processar login institucional.");
        navigate({ to: "/auth", replace: true });
        return;
      }

      if (data.session) {
        const user = data.session.user;
        
        // Validação de domínio institucional (Segurança)
        if (!user.email?.endsWith("@educacao.mg.gov.br")) {
          toast.error("Acesso permitido apenas para contas @educacao.mg.gov.br");
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
          return;
        }

        // Verificar se o cadastro interno foi concluído
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("profile_completed_at")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Erro ao carregar perfil no callback:", profileError);
        }

        if (!profile || !profile.profile_completed_at) {
          toast.info("Identificamos seu acesso institucional. Complete seu cadastro para continuar.");
          navigate({ to: "/completar-cadastro", replace: true });
        } else {
          const fullName = (user.user_metadata as any).full_name || 'Servidor';
          toast.success(`Bem-vindo, ${fullName}!`);
          navigate({ to: "/agenda-publica", replace: true });
        }
      } else {
          const fullName = (user.user_metadata as any).full_name || 'Servidor';
          toast.success(`Bem-vindo, ${fullName}!`);
          navigate({ to: "/agenda-publica", replace: true });
        }
      } else {
        // Sem sessão após o tempo de espera
        navigate({ to: "/auth", replace: true });
      }
    };

    handleAuthCallback();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background selection:bg-primary selection:text-primary-foreground">
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-2xl border-4 border-primary border-t-transparent shadow-2xl shadow-primary/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-primary animate-pulse">
            Autenticando Identidade
          </p>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-60">
            Frota SRE carangola
          </p>
        </div>
      </div>
    </div>
  );
}
