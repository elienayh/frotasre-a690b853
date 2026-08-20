import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    
    // Se não estiver logado, redireciona para login
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Validação de domínio institucional no carregamento da rota protegida (Segurança Camada 2)
    if (!data.user.email?.endsWith("@educacao.mg.gov.br")) {
      await supabase.auth.signOut();
      throw redirect({ 
        to: "/auth"
      });
    }

    // Primeiro acesso: cadastro interno ainda pendente de complementação.
    // Usuários antigos já possuem profile_completed_at preenchido e não são afetados.
    if (location.pathname !== "/completar-cadastro") {
      const { data: prof } = await supabase
        .from("profiles")
        .select("profile_completed_at")
        .eq("id", data.user.id)
        .maybeSingle();

      if (prof && !prof.profile_completed_at) {
        throw redirect({ to: "/completar-cadastro" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
