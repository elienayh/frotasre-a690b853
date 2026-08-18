import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Bus, CalendarCheck, ShieldCheck } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
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

  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Bus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold">Frota SRE</span>
        </div>
        <Button asChild variant="secondary">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <section className="grid gap-10 py-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sidebar-primary">
              Superintendência Regional de Ensino
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight md:text-5xl">
              Viagens oficiais organizadas do pedido à alocação do veículo
            </h1>
            <p className="mt-5 max-w-xl text-base text-sidebar-foreground/70">
              O servidor solicita o deslocamento. A DAFI analisa, aprova e define veículo, motorista
              e horário definitivo. Todos acompanham a agenda da frota em um só lugar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Acessar o sistema <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <ul className="space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.title}
                className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-5"
              >
                <item.icon className="h-5 w-5 text-sidebar-primary" aria-hidden="true" />
                <h2 className="mt-3 font-display text-base font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm text-sidebar-foreground/70">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
