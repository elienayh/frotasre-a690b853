import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "./client";

/**
 * Server function para buscar o email do usuário no Supabase Auth.
 * Como a tabela auth.users não é acessível via client, usamos este helper.
 * Em um ambiente real de produção com RLS restrito, isso precisaria de supabaseAdmin.
 */
export const getUserEmail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    
    if (error || !authUser?.user) {
       return { email: null };
    }
    
    return { email: authUser.user.email ?? null };
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
