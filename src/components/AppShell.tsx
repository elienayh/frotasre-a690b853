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
  Mail,
  MapPin,
  Menu,
  Route as RouteIcon,
  Users,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { useState, type ReactNode, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { NotificationsBell } from "@/components/NotificationsBell";
import { usePendingCounts } from "@/hooks/usePendingCounts";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Gauge;
}

const SERVER_ITEMS: NavItem[] = [
  { to: "/agenda-publica", label: "Cronograma", icon: CalendarRange },
  { to: "/viagens", label: "Minhas Viagens", icon: RouteIcon },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: "/admin/solicitacoes", label: "Aprovações", icon: ClipboardList },
  { to: "/admin/disponibilidade", label: "Disponibilidade da Frota", icon: Bus },
  { to: "/admin/veiculos", label: "Veículos", icon: CarFront },
  { to: "/admin/usuarios", label: "Usuários", icon: UserCog },
  { to: "/admin/cidades", label: "Cidades", icon: Building2 },
  { to: "/admin/destinos", label: "Locais de Destino", icon: MapPin },
];

function NavList({ isCollapsed, onNavigate }: { isCollapsed?: boolean; onNavigate?: () => void }) {
  const { isAdmin, isCoordinator, profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const counts = usePendingCounts();

  const getBadge = (label: string) => {
    if (!isAdmin) return null;
    
    let count = 0;
    let colorClass = "";

    if (label === "Aprovações") {
      count = counts.approvals;
      colorClass = "bg-destructive text-destructive-foreground ring-destructive/20";
    } else if (label === "Veículos") {
      count = counts.vehicles;
      colorClass = "bg-orange-500 text-white ring-orange-500/20";
    } else if (label === "Usuários") {
      count = counts.users;
      colorClass = "bg-blue-500 text-white ring-blue-500/20";
    }

    if (count <= 0) return null;

    return (
      <Badge 
        className={cn(
          "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 shadow-sm transition-all duration-300",
          colorClass,
          isCollapsed && "absolute -top-1 -right-1 ml-0 h-4 min-w-4 text-[8px] ring-1 shadow-lg"
        )}
      >
        {count}
      </Badge>
    );
  };

  const render = (items: NavItem[]) =>
    items.map((item) => {
      const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
      const badge = getBadge(item.label);

      return (
        <Link
          key={item.to}
          to={item.to}
          search={(prev: any) => {
            if (item.label === "Aprovações") return { filter: "pendentes" };
            if (item.label === "Veículos") return {};
            if (item.label === "Usuários") return {};
            return prev;
          }}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 group relative",
            active
              ? "bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20"
              : "text-muted-foreground hover:bg-accent/80 hover:text-foreground",
            isCollapsed && "justify-center px-0"
          )}
        >
          <item.icon className={cn("h-5 w-5 shrink-0", active ? "text-white" : "group-hover:scale-110 transition-transform")} aria-hidden="true" />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
          {badge}
          {isCollapsed && (
             <div className="absolute left-full ml-4 hidden group-hover:block z-50 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md border whitespace-nowrap">
               {item.label}
               {counts[item.label === "Aprovações" ? "approvals" : item.label === "Veículos" ? "vehicles" : item.label === "Usuários" ? "users" : "none" as keyof typeof counts] > 0 && 
                 ` (${counts[item.label === "Aprovações" ? "approvals" : item.label === "Veículos" ? "vehicles" : item.label === "Usuários" ? "users" : "none" as keyof typeof counts]})`
               }
             </div>
          )}
        </Link>
      );
    });

  return (
    <nav className={cn("flex flex-col gap-1.5 px-3", isCollapsed && "px-2")} aria-label="Navegação principal">
      {render(SERVER_ITEMS)}
      {isAdmin || profile?.is_sre_driver
        ? render([{ to: "/organizacao", label: "Organização do Dia", icon: CalendarRange }])
        : null}
      {isCoordinator
        ? render([{ to: "/setor", label: "Viagens do Setor", icon: Users }])
        : null}
      {isAdmin ? (
        <>
          <div className={cn("mt-6 mb-2 flex items-center px-3", isCollapsed && "justify-center px-0")}>
            <div className="h-[1px] flex-1 bg-border/50" />
            {!isCollapsed && <span className="mx-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">DAFI</span>}
            <div className="h-[1px] flex-1 bg-border/50" />
          </div>
          {render(ADMIN_ITEMS)}
        </>
      ) : null}
    </nav>
  );
}

function SidebarBrand({ isCollapsed }: { isCollapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-6 py-8", isCollapsed && "px-0 justify-center")}>
      <motion.div 
        whileHover={{ rotate: 5, scale: 1.05 }}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xl shadow-primary/30"
      >
        <Bus className="h-6 w-6" aria-hidden="true" />
      </motion.div>
      {!isCollapsed && (
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <span className="block font-display text-lg font-bold leading-none text-foreground tracking-tight">
            Frota SRE
          </span>
          <span className="block text-[10px] uppercase font-bold tracking-[0.2em] text-primary/70 mt-1">
            Minas Gerais
          </span>
        </motion.div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-full hover:bg-accent/80 transition-all duration-300"
    >
      <AnimatePresence mode="wait">
        {theme === "dark" ? (
          <motion.div
            key="moon"
            initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
          >
            <Moon className="h-5 w-5 text-primary" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
          >
            <Sun className="h-5 w-5 text-primary" />
          </motion.div>
        )}
      </AnimatePresence>
    </Button>
  );
}

export interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  fullWidth?: boolean;
}

export function AppShell({ title, description, actions, children }: AppShellProps) {
  const { profile, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background/95 transition-colors duration-500">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden lg:flex flex-col border-r border-border/40 bg-card/50 backdrop-blur-xl transition-all duration-300 sticky top-0 h-screen z-30",
          isCollapsed ? "w-20" : "w-72"
        )}
      >
        <SidebarBrand isCollapsed={isCollapsed} />
        
        <div className="flex-1 overflow-y-auto pb-6 scrollbar-hide">
          <NavList isCollapsed={isCollapsed} />
        </div>

        <div className={cn("p-4 space-y-4 border-t border-border/40", isCollapsed && "items-center px-2")}>
          {!isCollapsed && (
            <div className="px-2">
              <p className="truncate text-sm font-bold text-foreground">
                {profile?.full_name || user?.email}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {isAdmin ? "Administrador" : "Servidor"}
              </p>
            </div>
          )}
          
          <div className={cn("flex gap-1", isCollapsed ? "flex-col items-center" : "justify-between")}>
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="rounded-full hover:bg-primary/10 hover:text-primary text-muted-foreground transition-all duration-200"
              title="Registros de E-mail"
            >
              <a href="mailto:sre.carangola.transportes@educacao.mg.gov.br" target="_blank" rel="noopener noreferrer">
                <Mail className="h-5 w-5" />
              </a>
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all duration-200"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-full hidden lg:flex hover:bg-accent/80 transition-all duration-200"
            >
              {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Modern Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl md:px-8">
          {/* Mobile Menu Trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden rounded-full hover:bg-accent/80" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 border-r border-border/40 bg-card p-0">
              <SheetTitle className="sr-only">Menu principal</SheetTitle>
              <SidebarBrand />
              <div className="flex-1 overflow-y-auto py-2">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border/40 bg-card/80 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-4">
                  <Button variant="outline" asChild className="flex-1 rounded-xl gap-2">
                    <a href="mailto:sre.carangola.transportes@educacao.mg.gov.br">
                      <Mail className="h-4 w-4" /> E-mail Oficial
                    </a>
                  </Button>
                  <ThemeToggle />
                </div>
                <Button variant="destructive" className="w-full rounded-xl gap-2 shadow-lg shadow-destructive/20" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" /> Sair do Sistema
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex flex-1 items-center justify-between min-w-0">
            <div className="min-w-0">
              <motion.h1 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="truncate font-display text-xl font-extrabold tracking-tight text-foreground"
              >
                {title}
              </motion.h1>
              {description ? (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  className="truncate text-xs font-medium text-muted-foreground"
                >
                  {description}
                </motion.p>
              ) : null}
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
              <div className="h-8 w-[1px] bg-border/40 hidden md:block" />
              <NotificationsBell />
              {actions && (
                <div className="hidden sm:flex items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={cn("px-4 py-8 md:px-8 mx-auto", fullWidth ? "max-w-none" : "max-w-7xl")}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
