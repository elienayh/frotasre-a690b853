import type { Database } from "@/integrations/supabase/types";

export type TripStatus = Database["public"]["Enums"]["trip_status"];
export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
export type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];
export type DestinationRow = Database["public"]["Tables"]["destinations"]["Row"];
export type TripRow = Database["public"]["Tables"]["trip_requests"]["Row"];
export type BlockRow = Database["public"]["Tables"]["vehicle_blocks"]["Row"];

export const TRIP_STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Aguardando aprovação",
  CORRECAO: "Correção solicitada",
  APROVADA: "Aprovada",
  PROGRAMADA: "Programada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  REJEITADA: "Rejeitada",
  CANCELADA: "Cancelada",
};

export const FLEET_STATUS_LABEL: Record<string, string> = {
  DISPONIVEL: "Disponível",
  RESERVADO: "Reservado",
  EM_VIAGEM: "Em viagem",
  EM_MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponível",
  OCUPADO: "Ocupado",
  CAPACIDADE: "Capacidade insuficiente",
  INATIVO: "Inativo",
};

/** Classe de cor semântica para cada status (tokens do design system). */
export function statusTone(status: string): string {
  switch (status) {
    case "APROVADA":
    case "PROGRAMADA":
    case "DISPONIVEL":
    case "CONCLUIDA":
      return "bg-success/15 text-success border-success/30";
    case "PENDENTE":
    case "CORRECAO":
    case "RESERVADO":
      return "bg-warning/15 text-warning border-warning/30";
    case "EM_VIAGEM":
    case "EM_ANDAMENTO":
      return "bg-info/15 text-info border-info/30";
    case "REJEITADA":
    case "CANCELADA":
    case "EM_MANUTENCAO":
    case "INDISPONIVEL":
    case "OCUPADO":
    case "CAPACIDADE":
    case "INATIVO":
      return "bg-destructive/15 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});
const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const shortDateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateFmt.format(new Date(value));
}

export function fmtTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return timeFmt.format(new Date(value));
}

export function fmtShortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return shortDateFmt.format(new Date(value)).replace(".", "").toUpperCase();
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return `${fmtDate(value)} às ${fmtTime(value)}`;
}

export function fmtKm(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("pt-BR").format(value)} km`;
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

/** Converte o valor de um <input type="datetime-local"> em ISO UTC. */
export function localInputToIso(value: string): string {
  if (!value) return "";
  return new Date(value).toISOString();
}

/** Converte ISO UTC no formato aceito por <input type="datetime-local">. */
export function isoToLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Junta data (yyyy-mm-dd) + hora (hh:mm) locais em ISO UTC. */
export function dateTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

export function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Traduz erros vindos do banco para mensagens compreensíveis. */
export function friendlyDbError(message: string): string {
  if (message.includes("trips_vehicle_no_overlap")) {
    return "Este veículo já está reservado para outra viagem em horário conflitante.";
  }
  if (message.includes("trips_driver_no_overlap")) {
    return "Este motorista já está escalado para outra viagem em horário conflitante.";
  }
  return message;
}
