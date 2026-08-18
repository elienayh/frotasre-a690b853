import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  full_name: string;
  registration: string | null;
  sector: string | null;
  phone: string | null;
  is_active: boolean;
  is_coordinator: boolean;
  is_sre_driver: boolean;
  is_driver_certified: boolean;
  cpf: string | null;
  birth_date: string | null;
  mobile: string | null;
  cnh_number: string | null;
  cnh_categories: string[] | null;
  cnh_issued_at: string | null;
  cnh_expires_at: string | null;
  cnh_first_at: string | null;
  cnh_notes: string | null;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCoordinator: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  isSuperAdmin: false,
  isCoordinator: false,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadUserData(userId: string | undefined) {
    if (!userId) {
      setProfile(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      return;
    }
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, registration, sector, phone, is_active, is_coordinator, is_sre_driver, is_driver_certified, cpf, birth_date, mobile, cnh_number, cnh_categories, cnh_issued_at, cnh_expires_at, cnh_first_at, cnh_notes")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (prof && prof.is_active === false) {
      // Acesso desativado pelo administrador: encerra a sessão imediatamente.
      setProfile(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      await supabase.auth.signOut();
      return;
    }
    setProfile(prof ?? null);
    const roleList = (roles ?? []).map((r) => String(r.role));
    const superAdmin = roleList.includes("super_admin");
    setIsSuperAdmin(superAdmin);
    setIsAdmin(superAdmin || roleList.includes("admin"));
  }

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      // Evita chamadas ao banco dentro do callback do Supabase.
      setTimeout(() => {
        void loadUserData(newSession?.user?.id);
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadUserData(data.session?.user?.id);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    profile,
    isAdmin,
    isSuperAdmin,
    isCoordinator: Boolean(profile?.is_coordinator),
    refresh: async () => {
      await loadUserData(session?.user?.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
