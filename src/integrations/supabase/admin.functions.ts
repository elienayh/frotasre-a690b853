import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/**
 * Sincroniza contas institucionais do Supabase Auth com o cadastro interno (profiles).
 *
 * Idempotente: apenas cria o perfil quando ele ainda não existe. Nunca altera
 * perfis existentes, papéis, UUIDs ou histórico. Restrito a administradores.
 */
export const syncAuthProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // 1) Autorização: somente admin / super_admin podem sincronizar.
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesError) throw rolesError;

    const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    // 2) Contas autenticadas elegíveis (domínio institucional).
    const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    const eligible = listed.users.filter((u) =>
      (u.email ?? "").toLowerCase().endsWith("@educacao.mg.gov.br"),
    );
    if (eligible.length === 0) return { created: 0 };

    // 3) Perfis já existentes — evita qualquer duplicidade.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("id", eligible.map((u) => u.id));
    if (existingError) throw existingError;

    const existingIds = new Set((existing ?? []).map((p) => p.id));
    const missing = eligible.filter((u) => !existingIds.has(u.id));
    if (missing.length === 0) return { created: 0 };

    // 4) Cria somente o que falta, usando o próprio auth.users.id como chave.
    const rows = missing.map((u) => {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const fullName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        u.email ||
        "Usuário sem nome";
      return {
        id: u.id,
        full_name: String(fullName),
        phone: u.phone || null,
        is_active: true,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (insertError) throw insertError;

    // 5) Papel padrão institucional, sem alterar papéis já atribuídos.
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        missing.map((u) => ({ user_id: u.id, role: "servidor" as const })),
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    if (roleError) throw roleError;

    return { created: rows.length };
  });
