interface AuthSplashProps {
  /** Mensagem exibida abaixo do indicador de carregamento. */
  message?: string;
}

/**
 * Tela de carregamento exibida enquanto a sessão do usuário está sendo
 * verificada/restaurada. Evita o "flash" da tela de login logo após o
 * retorno do Google OAuth.
 */
export function AuthSplash({ message = "Verificando sua sessão..." }: AuthSplashProps) {
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
        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
