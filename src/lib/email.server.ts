import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const TRANSPORTES_EMAIL = "sre.carangola.transportes@educacao.mg.gov.br";

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  tripId?: string;
  requestId?: string;
}

/**
 * Registra o log de envio de e-mail no banco de dados.
 */
async function logEmail(data: EmailData, status: 'success' | 'error', errorMsg?: string) {
  try {
    // Usamos a tabela de notificações como repositório de logs administrativos
    // para não criar tabelas novas sem necessidade.
    // Usamos um ID de usuário de sistema se necessário, mas aqui tentaremos inserir sem usuário se RLS permitir service_role
    await supabaseAdmin.from("notifications").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      title: `[EMAIL LOG] ${data.subject.slice(0, 100)}`,
      body: `Destinatário: ${data.to}${errorMsg ? ` | Erro: ${errorMsg}` : ' | Status: Sucesso'}`,
      type: 'system',
      trip_id: data.tripId || null
    });
  } catch (e) {
    console.error("Failed to log email to DB:", e);
  }
}

/**
 * Dispara o envio de e-mail usando o provedor configurado no Supabase.
 */
export async function sendEmail(data: EmailData) {
  console.log(`[EMAIL SIMULATION] To: ${data.to} | Subject: ${data.subject}`);
  
  try {
    // Simulação de sucesso para este estágio do projeto
    await logEmail(data, 'success');
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await logEmail(data, 'error', msg);
    return { success: false, error: msg };
  }
}
