import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Bus,
  CalendarRange,
  CarFront,
  ClipboardList,
  Gauge,
  LogOut,
  MapPin,
  Menu,
  Route as RouteIcon,
  Users,
  UserCog,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { NotificationsBell } from "@/components/NotificationsBell";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Gauge;
}

const SERVER_ITEMS: NavItem[] = [
  { to: "/painel", label: "Início", icon: Gauge },
  { to: "/solicitacoes", label: "Minhas Solicitações", icon: ClipboardList },
  { to: "/viagens", label: "Minhas Viagens", icon: RouteIcon },
  { to: "/agenda-publica", label: "Viagens Programadas", icon: CalendarRange },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: "/admin/solicitacoes", label: "Aprovações", icon: ClipboardList },
  { to: "/admin/disponibilidade", label: "Disponibilidade da Frota", icon: Bus },
  { to: "/admin/agenda", label: "Agenda da Frota", icon: CalendarRange },
  { to: "/admin/veiculos", label: "Veículos", icon: CarFront },
  { to: "/admin/motoristas", label: "Motoristas", icon: Users },
  { to: "/admin/usuarios", label: "Usuários", icon: UserCog },
  { to: "/admin/cidades", label: "Cidades", icon: Building2 },
  { to: "/admin/destinos", label: "Locais de Destino", icon: MapPin },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, isCoordinator, profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const render = (items: NavItem[]) =>
    items.map((item) => {
      const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
      return (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Navegação principal">
      {render(SERVER_ITEMS)}
      {isCoordinator
        ? render([{ to: "/setor", label: "Viagens do Setor", icon: Users }])
        : null}
      {isAdmin ? (
        <>
          <p className="mt-5 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            DAFI
          </p>
          {render(ADMIN_ITEMS)}
        </>
      ) : null}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-3 px-6 py-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <Bus className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block font-display text-base font-bold leading-tight text-sidebar-foreground">
          Frota SRE
        </span>
        <span className="block text-xs text-sidebar-foreground/60">Gestão de viagens</span>
      </span>
    </div>
  );
}

export interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, description, actions, children }: AppShellProps) {
  const { profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarBrand />
        <div className="flex-1 overflow-y-auto pb-6">
          <NavList />
        </div>
        <div className="border-t border-sidebar-border p-4">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {profile?.full_name || user?.email}
          </p>
          <p className="text-xs text-sidebar-foreground/60">
            {isAdmin ? "Administrador da DAFI" : "Servidor"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="mt-3 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SidebarBrand />
              <NavList onNavigate={() => setOpen(false)} />
              <div className="mt-6 border-t border-sidebar-border p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full justify-start text-sidebar-foreground/80"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold text-foreground">{title}</h1>
            {description ? (
              <p className="truncate text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <NotificationsBell />
          {actions}
        </header>

        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
