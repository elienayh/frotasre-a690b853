import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // O Supabase Auth trata o fragmento (#) automaticamente se estiver usando a sessão client-side.
    // O onAuthStateChange ou getSession deve capturar a nova sessão.
    
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Erro no callback de autenticação:", error);
        toast.error("Erro ao processar login institucional.");
        navigate({ to: "/auth", replace: true });
        return;
      }

      if (data.session) {
        // Sessão recuperada com sucesso
        const user = data.session.user;
        
        // Verificação adicional de domínio (já existe no backend, mas reforçamos aqui)
        if (!user.email?.endsWith("@educacao.mg.gov.br")) {
          toast.error("Acesso permitido apenas para contas @educacao.mg.gov.br");
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
          return;
        }

        // Verificar se o perfil está completo
        const { data: profile } = await supabase
          .from("profiles")
          .select("registration, sector, cpf")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile || !profile.registration || !profile.sector || !profile.cpf) {
          // Se o cadastro estiver incompleto, direciona para completar (usando a rota de usuário existente ou uma nova)
          // Por enquanto, direcionamos para a página do perfil dele se for admin ou agenda se for comum
          // Mas o requisito pede uma tela de "Completar Cadastro".
          // Como ainda não temos uma rota /completar-cadastro, vamos usar a de detalhes do usuário
          // ou simplesmente permitir que ele complete depois, mas redirecionando para onde possa editar.
          
          toast.info("Por favor, complete seus dados cadastrais.");
          navigate({ to: "/agenda-publica", replace: true });
        } else {
          navigate({ to: "/agenda-publica", replace: true });
        }
      } else {
        // Se não tem sessão, talvez o hash ainda não tenha sido processado ou houve falha
        // Vamos dar um pequeno delay para garantir
        setTimeout(async () => {
          const { data: retryData } = await supabase.auth.getSession();
          if (retryData.session) {
            navigate({ to: "/agenda-publica", replace: true });
          } else {
            navigate({ to: "/auth", replace: true });
          }
        }, 1000);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
          Autenticando...
        </p>
      </div>
    </div>
  );
}
