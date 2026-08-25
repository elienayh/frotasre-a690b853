import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Bus, CalendarCheck, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

import { useAuth } from "@/hooks/useAuth";
import { AuthSplash } from "@/components/AuthSplash";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Frota SRE — Solicitação e gestão de viagens oficiais" },
      {
        name: "description",
        content:
          "Camada interna da SRE para solicitação antecipada de viagens, aprovação pela DAFI, alocação de veículos e agenda da frota.",
      },
      { property: "og:title", content: "Frota SRE" },
      {
        property: "og:description",
        content:
          "Solicite viagens, acompanhe aprovações da DAFI e consulte a disponibilidade da frota oficial.",
      },
    ],
  }),
  component: Index,
});

const HIGHLIGHTS = [
  {
    icon: CalendarCheck,
    title: "Solicitação antecipada",
    text: "O servidor informa data, horários, destino, motivo e ocupantes. O veículo é definido pela DAFI.",
  },
  {
    icon: Bus,
    title: "Frota sob controle",
    text: "Disponibilidade calculada por data e horário, com bloqueio de conflitos, manutenção e lotação.",
  },
  {
    icon: ShieldCheck,
    title: "PW/Prodemge preservado",
    text: "O sistema organiza internamente; o lançamento oficial continua sendo feito pela DAFI no PW.",
  },
];

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: "/agenda-publica", replace: true });
    }
  }, [loading, session, navigate]);

  // Sessão em verificação ou já autenticado: exibe splash em vez da landing.
  if (loading || session) {
    return <AuthSplash message={session ? "Abrindo o Cronograma..." : "Carregando..."} />;
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary selection:text-primary-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-background/60 border-b border-border/40 max-w-7xl mx-auto rounded-b-3xl mt-2 shadow-2xl shadow-primary/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Bus className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
             <span className="block font-display text-lg font-black tracking-tighter text-foreground">Frota SRE</span>
             <span className="block text-[8px] uppercase font-black tracking-[0.2em] text-primary">Minas Gerais</span>
          </div>
        </div>
        <Button asChild variant="ghost" className="rounded-xl font-bold hover:bg-primary/10 hover:text-primary">
          <Link to="/auth">Entrar no Sistema</Link>
        </Button>
      </header>

      <main className="relative pt-32 pb-20 px-6 max-w-6xl mx-auto overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-success/5 rounded-full blur-3xl -z-10" />

        <section className="grid gap-16 py-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="space-y-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Superintendência Regional de Ensino
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-display text-5xl font-black leading-[1.1] tracking-tighter text-foreground md:text-7xl"
            >
              Gestão inteligente de <span className="text-primary italic">viagens oficiais</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-xl text-lg font-medium text-muted-foreground leading-relaxed"
            >
              Do pedido do servidor à alocação estratégica do veículo. Acompanhe a agenda da frota em tempo real com transparência e eficiência.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <Button asChild size="lg" className="h-14 px-8 rounded-2xl text-base font-bold shadow-2xl shadow-primary/30 hover:-translate-y-1 transition-transform">
                <Link to="/auth">
                  Acessar Sistema <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="grid gap-6"
          >
            {HIGHLIGHTS.map((item, idx) => (
              <div
                key={item.title}
                className="group relative rounded-3xl border border-border/40 bg-card/60 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:border-primary/20 hover:-translate-y-1"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                   <item.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-display text-lg font-black tracking-tight text-foreground">{item.title}</h2>
                <p className="mt-2 text-sm font-medium text-muted-foreground leading-relaxed">{item.text}</p>
              </div>
            ))}
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-border/40 bg-card/30 backdrop-blur-md py-12 mt-20">
         <div className="max-w-6xl mx-auto px-6 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              © 2026 Frota SRE — Desenvolvido para a Superintendência Regional de Ensino
            </p>
         </div>
      </footer>
    </div>
  );
}

