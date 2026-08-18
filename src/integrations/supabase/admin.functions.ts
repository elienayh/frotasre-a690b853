import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "./supabase/client";

/**
 * Server function para buscar o email do usuário no Supabase Auth.
 * Como a tabela auth.users não é acessível via client, usamos este helper.
 * Em um ambiente real de produção com RLS restrito, isso precisaria de supabaseAdmin.
 */
export const getUserEmail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    // Tenta buscar o email no profile primeiro (assumindo que existe a coluna)
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .single();
    
    if (error || !profile?.email) {
       // Em Lovable Cloud, se o email não estiver no profile, 
       // o admin pode precisar cadastrá-lo ou sincronizá-lo.
       return { email: null };
    }
    
    return { email: profile.email };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    // Em Lovable, a exclusão física de um usuário Auth deve ser feita via Admin Client
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Verificar se o usuário existe
    const { data: user, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (fetchError || !user) throw new Error("Usuário não encontrado no Auth.");

    // 2. Excluir no Auth (isso dispara cascata se configurado ou remove o profile se houver trigger)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (deleteError) throw deleteError;

    return { success: true };
  });
