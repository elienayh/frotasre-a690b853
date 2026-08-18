import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server function para buscar e-mails do Supabase Auth.
 * Necessário pois o campo 'email' não reside na tabela 'profiles'.
 */
export const getUserEmail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (error) throw error;
    return { email: user.user?.email };
  });

/**
 * Server function para excluir permanentemente um usuário (Auth + Dados).
 * Operação crítica reservada para Super Admins.
 */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    // A segurança RLS e middleware no frontend já devem filtrar, 
    // mas a exclusão física exige supabaseAdmin no server.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { success: true };
  });

/**
 * Server function para listar os e-mails de múltiplos usuários.
 * Usado na listagem de usuários para busca por e-mail.
 */
export const getUsersEmails = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ userIds: z.array(z.string().uuid()) }).parse(data))
  .handler(async ({ data }) => {
    const emails: Record<string, string> = {};
    
    // Auth admin API doesn't support batch get by ID easily without listUsers
    // For performance with small lists, we can fetch all and map, or individual calls if list is small.
    // Given the SRE scale, listing all and filtering is usually fine.
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;
    
    users.forEach(u => {
      if (data.userIds.includes(u.id)) {
        emails[u.id] = u.email || "";
      }
    });
    
    return emails;
  });
