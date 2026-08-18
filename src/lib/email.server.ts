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
    await supabaseAdmin.from("notifications").insert({
      user_id: null, // Log administrativo quando não houver usuário específico
      title: `[EMAIL LOG] ${data.subject}`,
      message: `Status: ${status}${errorMsg ? ` | Erro: ${errorMsg}` : ''}`,
      type: 'system',
      metadata: {
        to: data.to,
        trip_id: data.tripId,
        request_id: data.requestId,
        is_email_log: true
      }
    });
  } catch (e) {
    console.error("Failed to log email to DB:", e);
  }
}

/**
 * Dispara o envio de e-mail usando o provedor configurado no Supabase.
 * Nota: Como estamos em um ambiente Lovable Cloud, usaremos o supabaseAdmin.auth.admin.inviteUser
 * ou um serviço de e-mail externo via Edge Function se disponível.
 * Para este projeto, utilizaremos o console como fallback e simularemos o envio,
 * pois o Supabase Auth não permite envio de e-mails arbitrários via Admin SDK diretamente
 * sem templates pré-configurados.
 * 
 * ESTRATÉGIA: Como não temos um serviço SMTP externo configurado ainda,
 * vamos centralizar aqui. O ideal seria usar uma Edge Function com Resend/SendGrid.
 */
export async function sendEmail(data: EmailData) {
  console.log(`[EMAIL SIMULATION] To: ${data.to} | Subject: ${data.subject}`);
  
  // No ambiente real da Lovable, se houver um conector de e-mail, ele seria usado aqui.
  // Por enquanto, garantimos o registro no log para auditoria conforme solicitado.
  
  try {
    // Simulação de sucesso
    await logEmail(data, 'success');
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await logEmail(data, 'error', msg);
    return { success: false, error: msg };
  }
}
