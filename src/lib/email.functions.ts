import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, TRANSPORTES_EMAIL } from "./email.server";

const StopSchema = z.object({
  city: z.string().nullable(),
  place: z.string().nullable(),
  driver_name: z.string().nullable(),
});

/**
 * Notifica o setor de transportes sobre uma nova solicitação.
 */
export const notifyNewTripRequest = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    tripId: z.string().uuid(),
    requesterName: z.string(),
    sector: z.string().nullable(),
    departureAt: z.string(),
    returnAt: z.string(),
    purpose: z.string(),
    occupants: z.array(z.string()),
    stops: z.array(StopSchema),
    code: z.number().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const dateStr = new Date(data.departureAt).toLocaleDateString('pt-BR');
    const subject = `[NOVA SOLICITAÇÃO DE TRANSPORTE] ${data.code ? `#${data.code}` : 'Solicitação'} — ${dateStr}`;

    const html = `
      <div style="font-family: sans-serif; color: #333;">
        <h2>Nova solicitação de transporte registrada no Frota SRE.</h2>
        <p><strong>Número da solicitação:</strong> #${data.code || '---'}</p>
        <p><strong>Solicitante:</strong> ${data.requesterName}</p>
        <p><strong>Setor:</strong> ${data.sector || 'Não informado'}</p>
        <p><strong>Data da viagem:</strong> ${dateStr}</p>
        <p><strong>Data de retorno:</strong> ${new Date(data.returnAt).toLocaleDateString('pt-BR')}</p>
        
        <h3>Destinos:</h3>
        <ol>
          ${data.stops.map(s => `
            <li>
              <strong>${s.city || '---'}</strong> - ${s.place || '---'}<br/>
              <small>Motorista: ${s.driver_name || 'DAFI DEFINIR'}</small>
            </li>
          `).join('')}
        </ol>

        <p><strong>Quantidade:</strong> ${data.occupants.length} pessoas</p>
        <p><strong>Motivo:</strong> ${data.purpose}</p>
        <p><strong>Status:</strong> Aguardando aprovação</p>
        
        <div style="margin-top: 20px;">
          <a href="https://frotasre.lovable.app/admin/solicitacoes?filter=pendentes" 
             style="background: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Ver solicitação no Frota SRE
          </a>
        </div>
      </div>
    `;

    return await sendEmail({
      to: TRANSPORTES_EMAIL,
      subject,
      html,
      tripId: data.tripId
    });
  });

/**
 * Notifica o solicitante sobre o resultado da análise (Aprovação/Recusa).
 */
export const notifyTripDecision = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    tripId: z.string().uuid(),
    userId: z.string().uuid(),
    status: z.enum(["APROVADA", "REJEITADA", "CORRECAO"]),
    rejectionReason: z.string().nullable().optional(),
    vehicleName: z.string().nullable().optional(),
    driverName: z.string().nullable().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    // Busca e-mail do usuário
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (error || !user.user?.email) return { success: false, error: "Usuário sem e-mail" };

    // Busca detalhes da viagem para o corpo do e-mail
    const { data: trip } = await supabaseAdmin
      .from("trip_requests")
      .select("*")
      .eq("id", data.tripId)
      .single();

    if (!trip) return { success: false, error: "Viagem não encontrada" };

    const dateStr = new Date(trip.departure_at).toLocaleDateString('pt-BR');
    const isApproved = data.status === "APROVADA";
    
    const subject = isApproved 
      ? `[TRANSPORTE APROVADO] Solicitação #${trip.code} — ${dateStr}`
      : `[TRANSPORTE NÃO APROVADO] Solicitação #${trip.code}`;

    const html = `
      <div style="font-family: sans-serif; color: #333;">
        <h2>${isApproved ? 'Sua solicitação de transporte foi aprovada.' : 'Sua solicitação de transporte não foi aprovada.'}</h2>
        <p><strong>Solicitação:</strong> #${trip.code}</p>
        <p><strong>Data da viagem:</strong> ${dateStr}</p>
        <p><strong>Destino principal:</strong> ${trip.city_text || '---'}</p>
        <p><strong>Status:</strong> ${data.status === "APROVADA" ? "Aprovada" : data.status === "REJEITADA" ? "Indisponível" : "Ajuste"}</p>
        
        ${isApproved ? `
          <p><strong>Veículo:</strong> ${data.vehicleName || 'A DEFINIR'}</p>
          <p><strong>Motorista:</strong> ${data.driverName || 'DAFI DEFINIR'}</p>
        ` : ''}

        ${data.rejectionReason ? `<p><strong>Motivo:</strong> ${data.rejectionReason}</p>` : ''}

        <div style="margin-top: 20px;">
          <a href="https://frotasre.lovable.app/viagens" 
             style="background: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Ver minha viagem
          </a>
        </div>
      </div>
    `;

    return await sendEmail({
      to: user.user.email,
      subject,
      html,
      tripId: data.tripId
    });
  });

/**
 * Notifica sobre nova solicitação de carona.
 */
export const notifyNewRideRequest = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    rideId: z.string().uuid(),
    requesterName: z.string(),
    tripCode: z.number().optional(),
    tripDestination: z.string(),
    date: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    const subject = `[NOVA SOLICITAÇÃO DE CARONA] Viagem #${data.tripCode || '---'} — ${data.requesterName}`;
    
    const html = `
      <div style="font-family: sans-serif; color: #333;">
        <h2>Nova solicitação de carona registrada no Frota SRE.</h2>
        <p><strong>Viagem relacionada:</strong> #${data.tripCode || '---'}</p>
        <p><strong>Solicitante da carona:</strong> ${data.requesterName}</p>
        <p><strong>Data:</strong> ${new Date(data.date).toLocaleDateString('pt-BR')}</p>
        <p><strong>Cidade:</strong> ${data.tripDestination}</p>
        
        <div style="margin-top: 20px;">
          <a href="https://frotasre.lovable.app/admin/solicitacoes?filter=carona" 
             style="background: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Ver pedido de carona
          </a>
        </div>
      </div>
    `;

    return await sendEmail({
      to: TRANSPORTES_EMAIL,
      subject,
      html,
      requestId: data.rideId
    });
  });

/**
 * Notifica o solicitante da carona sobre o resultado.
 */
export const notifyRideDecision = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    rideId: z.string().uuid(),
    userId: z.string().uuid(),
    status: z.enum(["APROVADA", "REJEITADA"]),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (error || !user.user?.email) return { success: false, error: "Usuário sem e-mail" };

    const { data: ride } = await supabaseAdmin
      .from("ride_requests")
      .select("*, trip:trip_requests(code, destination_text, departure_at)")
      .eq("id", data.rideId)
      .single();

    if (!ride) return { success: false, error: "Carona não encontrada" };

    const isApproved = data.status === "APROVADA";
    const subject = isApproved 
      ? `[CARONA APROVADA] Viagem #${(ride.trip as any)?.code}`
      : `[CARONA NÃO APROVADA] Viagem #${(ride.trip as any)?.code}`;

    const html = `
      <div style="font-family: sans-serif; color: #333;">
        <h2>${isApproved ? 'Sua solicitação de carona foi aprovada.' : 'Sua solicitação de carona não foi aprovada.'}</h2>
        <p><strong>Viagem:</strong> #${(ride.trip as any)?.code}</p>
        <p><strong>Destino:</strong> ${(ride.trip as any)?.destination_text}</p>
        <p><strong>Data:</strong> ${new Date((ride.trip as any)?.departure_at).toLocaleDateString('pt-BR')}</p>
        
        <div style="margin-top: 20px;">
          <a href="https://frotasre.lovable.app/viagens" 
             style="background: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Ver viagem
          </a>
        </div>
      </div>
    `;

    return await sendEmail({
      to: user.user.email,
      subject,
      html,
      requestId: data.rideId
    });
  });
