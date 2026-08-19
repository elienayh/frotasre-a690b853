import { supabase } from "@/integrations/supabase/client";

/** Formata quilometragem com separador de milhar. */
export function fmtKm(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
}

/** Formata data dd/mm/aaaa. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Formata hora hh:mm. */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Formata data e hora dd/mm/aaaa hh:mm. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

/** Converte ISO para formato aceito em <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converte local input para ISO UTC. */
export function localInputToIso(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString();
}

/** Data de hoje em formato <input type="date">. */
export function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Mapeamento de status da frota para labels amigáveis. */
export const FLEET_STATUS_LABEL: Record<string, string> = {
  DISPONIVEL: "Disponível",
  RESERVADO: "Reservado",
  EM_VIAGEM: "Em viagem",
  EM_MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponível",
  INATIVO: "Inativo",
};

/** Mapeamento de status de viagem para labels amigáveis. */
export const TRIP_STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  CORRECAO: "Ajuste",
  APROVADA: "Aprovada",
  PROGRAMADA: "Programada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
  REJEITADA: "Rejeitada",

};

/** Estilo de cor para o status. */
export function statusTone(status: string): string {
  const s = String(status).toUpperCase();
  if (["APROVADA", "PROGRAMADA", "DISPONIVEL", "CONCLUIDA", "ATENDIDA"].includes(s))
    return "border-success/30 bg-success/10 text-success";
  if (["PENDENTE", "CORRECAO", "RESERVADO", "EM_ANDAMENTO", "ATRASADA", "PARCIAL"].includes(s))

    return "border-warning/30 bg-warning/10 text-warning";
  if (["REJEITADA", "CANCELADA", "INDISPONIVEL", "INATIVO", "EM_MANUTENCAO", "INCIDENTE"].includes(s))
    return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border bg-muted/50 text-muted-foreground";
}

/** Calcula a autonomia estimada baseada nos últimos abastecimentos. */
export function calculateAutonomy(fuels: any[]): string {
  if (fuels.length < 2) return "N/A";
  const sorted = [...fuels].sort((a, b) => new Date(b.filled_at).getTime() - new Date(a.filled_at).getTime());
  const latest = sorted[0];
  const previous = sorted[1];
  if (!latest.odometer || !previous.odometer || !latest.liters) return "N/A";
  const km = latest.odometer - previous.odometer;
  if (km <= 0) return "N/A";
  const consumption = (km / latest.liters).toFixed(2);
  return `${consumption} km/L`;
}

/** Helper para converter data/hora em ISO. */
export function dateTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

/** Tradução amigável de erros comuns do banco. */
export function friendlyDbError(msg: string): string {
  // Apenas violações reais de chave única viram a mensagem de duplicidade.
  // Mensagens como "no unique or exclusion constraint matching the ON CONFLICT
  // specification" não são duplicidade e não devem ser mascaradas.
  if (/duplicate key value|already exists/i.test(msg))
    return "Já existe um registro com estes dados.";
  if (msg.includes("foreign key")) return "Não é possível realizar a ação: existem registros vinculados.";
  return msg;
}


/** Tipos de viagem comuns. */
export interface TripRow {
  id?: string;
  code?: number;
  status?: string;
  departure_at?: string;
  return_at?: string;
  destination_text?: string;
  purpose?: string;
  passengers?: number;
  requester_id?: string | null;
  requester_name?: string | null;
  requester_notes?: string | null;
  admin_notes?: string | null;
  vehicle_id?: string | null;
  assigned_driver_user_id?: string | null;
  requested_driver_id?: string | null;
  suggested_driver?: string | null;
  needs_sre_driver?: boolean;
  allows_rides?: boolean;
  approved_at?: string | null;
  approved_by?: string | null;
  organized_at?: string | null;
  organized_by?: string | null;
  odometer_start?: number | null;
  odometer_end?: number | null;
  city_id?: string | null;
  city_text?: string | null;
  destination_id?: string | null;
}
