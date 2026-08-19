import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ChevronRight, X, UserX, ShieldCheck, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { getUsersEmails, syncAuthProfiles } from "@/integrations/supabase/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios/")({
  component: UsuariosList,
});



interface Profile {
  id: string;
  full_name: string;
  registration: string | null;
  sector: string | null;
  is_active: boolean;
  is_coordinator: boolean;
  is_sre_driver: boolean;
  is_driver_certified: boolean;
  cnh_expires_at: string | null;
}

function UsuariosList() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { pending?: boolean };
  const [searchTerm, setSearchTerm] = useState("");
  
  // Initialize filters based on search param or defaults
  const [filters, setFilters] = useState(() => ({
    admin: false,
    superAdmin: false,
    coordinator: false,
    driver: false,
    certified: false,
    // Only apply pending filter if explicitly passed as true
    active: search?.pending === true ? false : true,
    inactive: search?.pending === true ? true : false,
  }));

  // Sync filters when search param changes
  useEffect(() => {
    // If pending is undefined, we want to show all (active by default as per UI intent)
    // or reset to a clean state.
    if (search?.pending === true) {
      setFilters(f => ({
        ...f,
        active: false,
        inactive: true
      }));
    } else if (search?.pending === false) {
      setFilters(f => ({
        ...f,
        active: true,
        inactive: false
      }));
    }
    // We don't automatically reset filters to "clean" if search.pending is undefined 
    // to avoid clearing user's manual filter selections during navigation 
    // UNLESS it's the initial mount and we want a clean state.
  }, [search?.pending]);

  const fetchEmails = useServerFn(getUsersEmails);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, registration, sector, is_active, is_coordinator, is_sre_driver, is_driver_certified, cnh_expires_at, mobile")
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data as { user_id: string; role: string }[];
    },
  });

  const { data: emails = {} } = useQuery({
    queryKey: ["user-emails-list", profiles.map(p => p.id)],
    queryFn: async () => {
      if (profiles.length === 0) return {};
      return fetchEmails({ data: { userIds: profiles.map(p => p.id) } });
    },
    enabled: profiles.length > 0,
  });

  const roleOf = (id: string) => roles.filter((r) => r.user_id === id).map((r) => r.role);

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'active' && value === true) return false; // Default
    if (key === 'inactive' && value === false) return false; // Default
    return !!value;
  }).length;

  const isLoading = profilesLoading || rolesLoading;

  const filteredProfiles = useMemo(() => {
    // If we're still loading, don't filter yet to avoid showing "No users found"
    if (isLoading) return [];
    
    return profiles.filter((p) => {
      const pRoles = roleOf(p.id);
      const email = emails[p.id]?.toLowerCase() || "";
      
      const matchesSearch = 
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.registration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p as any).mobile?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.includes(searchTerm.toLowerCase());

      const matchesFilters = 
        (!filters.admin || pRoles.includes("admin")) &&
        (!filters.superAdmin || pRoles.includes("super_admin")) &&
        (!filters.coordinator || p.is_coordinator) &&
        (!filters.driver || p.is_sre_driver) &&
        (!filters.certified || p.is_driver_certified) &&
        ((filters.active && p.is_active) || (filters.inactive && !p.is_active) || (!filters.active && !filters.inactive));

      return matchesSearch && matchesFilters;
    });
  }, [profiles, roles, emails, searchTerm, filters, isLoading]);

  return (
    <AppShell title="Gestão de Usuários" description="Gerencie usuários, funções e permissões.">
      <div className="space-y-6">
        {/* Header/Filters Area */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between bg-card/40 p-4 rounded-3xl border border-border/40 backdrop-blur-md">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="Buscar por nome, matrícula, e-mail institucional ou setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 bg-background/50 border-border/40 rounded-2xl focus-visible:ring-primary/20"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 px-4 rounded-2xl border-border/40 bg-background/50 gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="default" className="ml-1 h-5 min-w-5 px-1 rounded-full text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4 rounded-2xl border-border/40" align="end">
                <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground px-1">Status da Conta</h4>
                  <div className="grid gap-2">
                    <div className="flex items-center space-x-2 p-2 hover:bg-accent/50 rounded-xl transition-colors">
                      <Checkbox 
                        id="active" 
                        checked={filters.active} 
                        onCheckedChange={(c) => setFilters(f => ({ ...f, active: !!c }))} 
                      />
                      <Label htmlFor="active" className="text-sm font-medium flex items-center gap-2 cursor-pointer w-full">
                        <UserCheck className="h-3 w-3 text-success" /> Ativos
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-2 hover:bg-accent/50 rounded-xl transition-colors">
                      <Checkbox 
                        id="inactive" 
                        checked={filters.inactive} 
                        onCheckedChange={(c) => setFilters(f => ({ ...f, inactive: !!c }))} 
                      />
                      <Label htmlFor="inactive" className="text-sm font-medium flex items-center gap-2 cursor-pointer w-full">
                        <UserX className="h-3 w-3 text-destructive" /> Inativos
                      </Label>
                    </div>
                  </div>
                  
                  <div className="h-[1px] bg-border/40 my-2" />
                  
                  <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground px-1">Funções e Permissões</h4>
                  <div className="grid gap-2">
                    {[
                      { id: "admin", label: "Administradores", icon: ShieldCheck },
                      { id: "superAdmin", label: "Super Admin", icon: ShieldCheck },
                      { id: "coordinator", label: "Coordenadores", icon: UserCheck },
                      { id: "driver", label: "Motoristas SRE", icon: UserCheck },
                      { id: "certified", label: "Credenciados", icon: UserCheck },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center space-x-2 p-2 hover:bg-accent/50 rounded-xl transition-colors">
                        <Checkbox 
                          id={item.id} 
                          checked={(filters as any)[item.id]} 
                          onCheckedChange={(c) => setFilters(f => ({ ...f, [item.id]: !!c }))} 
                        />
                        <Label htmlFor={item.id} className="text-sm font-medium cursor-pointer w-full">
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground"
                    onClick={() => setFilters({
                      admin: false,
                      superAdmin: false,
                      coordinator: false,
                      driver: false,
                      certified: false,
                      active: true,
                      inactive: false,
                    })}
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Counter */}
        <div className="flex items-center justify-between px-2">
          <p className="text-sm font-medium text-muted-foreground">
            {filteredProfiles.length} {filteredProfiles.length === 1 ? "usuário encontrado" : "usuários encontrados"}
          </p>
        </div>

        {/* List Content */}
        <div className="grid gap-2">
          {isLoading ? (
            <div className="space-y-4 py-10">
              <div className="flex items-center justify-center gap-3 text-muted-foreground animate-pulse">
                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-sm font-medium tracking-wide uppercase">Carregando usuários...</span>
              </div>
              <div className="grid gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
                ))}
              </div>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card/20 rounded-[2rem] border border-dashed border-border/60">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">Nenhum usuário encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
                {searchTerm || activeFilterCount > 0 
                  ? `Não encontramos resultados para "${searchTerm}" com os filtros aplicados.`
                  : "Não há usuários cadastrados no sistema."}
              </p>
              {(searchTerm || activeFilterCount > 0) && (
                <Button 
                  variant="outline" 
                  className="mt-6 rounded-xl"
                  onClick={() => {
                    setSearchTerm("");
                    setFilters({
                      admin: false,
                      superAdmin: false,
                      coordinator: false,
                      driver: false,
                      certified: false,
                      active: true,
                      inactive: false,
                    });
                  }}
                >
                  Limpar busca e filtros
                </Button>
              )}
            </div>
          ) : (
            filteredProfiles.map((p) => (
              <Link
                key={p.id}
                to="/admin/usuarios/$userId"
                params={{ userId: p.id }}
                className={cn(
                  "group relative flex items-center justify-between overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-3 backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:bg-card/60 hover:-translate-y-0.5",
                  !p.is_active && "opacity-75 grayscale-[0.5]"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0 flex-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-bold text-foreground truncate uppercase group-hover:text-primary transition-colors">
                        {p.full_name || "Sem nome"}
                      </p>
                      {!p.is_active && (
                        <Badge variant="destructive" className="h-4 px-1 text-[8px]">INATIVO</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50 px-1.5 rounded-md">
                        {p.sector ?? "Sem setor"}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground/60">
                        {p.registration ? `Matrícula ${p.registration}` : "Matrícula não informada"}
                      </span>
                      {emails[p.id] && (
                        <span className="hidden md:inline text-[10px] font-medium text-muted-foreground/60 italic">
                          • {emails[p.id]}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 sm:justify-end pr-8">
                    {p.is_coordinator && (
                      <Badge variant="outline" className="rounded-lg h-5 border-blue-500/20 text-blue-500 bg-blue-500/5">Coord.</Badge>
                    )}
                    {p.is_driver_certified && (
                      <Badge variant="outline" className="rounded-lg h-5 border-cyan-500/20 text-cyan-500 bg-cyan-500/5">Credenc.</Badge>
                    )}
                    {p.is_sre_driver && (
                      <Badge variant="outline" className="rounded-lg h-5 border-success/20 text-success bg-success/5">Motorista</Badge>
                    )}
                    {roleOf(p.id).includes("super_admin") && (
                      <Badge variant="destructive" className="rounded-lg h-5 shadow-sm shadow-destructive/20">Super Admin</Badge>
                    )}
                    {roleOf(p.id).includes("admin") && (
                      <Badge variant="secondary" className="rounded-lg h-5 border-border/40">Admin</Badge>
                    )}
                  </div>
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-hover:text-primary transition-colors group-hover:translate-x-1 duration-300">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
