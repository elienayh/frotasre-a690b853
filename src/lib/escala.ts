import type { Database } from "@/integrations/supabase/types";

export type ScheduleStatus = Database["public"]["Enums"]["schedule_status"];
export type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];
export type SegmentType = Database["public"]["Enums"]["segment_type"];

export const SCHEDULE_STATUS: ScheduleStatus[] = [
  "RASCUNHO",
  "PLANEJADA",
  "PUBLICADA",
  "EM_EXECUCAO",
  "CONCLUIDA",
  "CANCELADA",
];

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  RASCUNHO: "Rascunho",
  PLANEJADA: "Planejada",
  PUBLICADA: "Publicada",
  EM_EXECUCAO: "Em execução",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  PENDENTE: "Pendente",
  PROGRAMADO: "Programado",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  NAO_REALIZADO: "Não realizado",
  CANCELADO: "Cancelado",
};

export const SEGMENT_TYPES: SegmentType[] = [
  "LEVAR",
  "BUSCAR",
  "DESLOCAMENTO",
  "AGUARDAR",
  "RETORNO",
];

export const SEGMENT_LABEL: Record<SegmentType, string> = {
  LEVAR: "Levar",
  BUSCAR: "Buscar",
  DESLOCAMENTO: "Deslocamento",
  AGUARDAR: "Aguardar",
  RETORNO: "Retorno",
};

export const INCIDENT_KINDS = [
  "ATRASO",
  "AUSENCIA",
  "PROBLEMA_VEICULO",
  "ALTERACAO_DESTINO",
  "CANCELAMENTO_LOCAL",
  "OUTRO",
] as const;

export const INCIDENT_LABEL: Record<string, string> = {
  ATRASO: "Atraso",
  AUSENCIA: "Passageiro não compareceu",
  PROBLEMA_VEICULO: "Veículo apresentou problema",
  ALTERACAO_DESTINO: "Alteração de destino",
  CANCELAMENTO_LOCAL: "Cancelamento no local",
  OUTRO: "Outro",
};

/** Cor semântica de cada status de escala/atendimento. */
export function scheduleTone(status: string): string {
  switch (status) {
    case "PUBLICADA":
    case "PROGRAMADO":
      return "bg-info/15 text-info border-info/30";
    case "EM_EXECUCAO":
    case "EM_ANDAMENTO":
      return "bg-warning/15 text-warning border-warning/30";
    case "CONCLUIDA":
    case "CONCLUIDO":
      return "bg-success/15 text-success border-success/30";
    case "CANCELADA":
    case "CANCELADO":
    case "NAO_REALIZADO":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "PLANEJADA":
      return "bg-primary/15 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const longDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** "quarta-feira, 12 de agosto de 2026" */
export function fmtLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return longDate.format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** Data local em yyyy-mm-dd. */
export function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Soma dias a uma data yyyy-mm-dd. */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

/** ISO -> "HH:mm" no fuso local. */
export function toTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "yyyy-mm-dd" + "HH:mm" -> ISO UTC. */
export function dayTimeToIso(dateStr: string, time: string): string {
  return new Date(`${dateStr}T${time}:00`).toISOString();
}

/** Limites do dia em ISO, úteis nas consultas. */
export function dayRange(dateStr: string): { start: string; end: string } {
  return { start: dayTimeToIso(dateStr, "00:00"), end: dayTimeToIso(shiftDate(dateStr, 1), "00:00") };
}

/** Duração legível entre dois instantes. */
export function durationLabel(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((+new Date(endIso) - +new Date(startIso)) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m} min`;
}
