/** Regras e rótulos do cadastro de motoristas/condutores. */

export const DRIVER_TYPES = ["SRE", "AUTORIZADO", "OUTRO"] as const;
export type DriverType = (typeof DRIVER_TYPES)[number];

export const DRIVER_TYPE_LABEL: Record<string, string> = {
  SRE: "Motorista da SRE",
  AUTORIZADO: "Condutor autorizado",
  OUTRO: "Outro usuário",
};

export const CNH_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"] as const;

export type CnhState = "SEM_CNH" | "VALIDA" | "PROXIMA" | "VENCIDA";

export interface CnhStatus {
  state: CnhState;
  label: string;
  /** Classe com tokens semânticos do design system. */
  tone: string;
  /** Indica se o condutor está apto do ponto de vista documental. */
  apt: boolean;
  daysLeft: number | null;
}

/** Dias de antecedência para alertar sobre o vencimento da CNH. */
export const CNH_WARNING_DAYS = 60;

export function cnhStatus(expiresAt: string | null | undefined): CnhStatus {
  if (!expiresAt) {
    return {
      state: "SEM_CNH",
      label: "CNH não informada",
      tone: "bg-muted text-muted-foreground border-border",
      apt: true,
      daysLeft: null,
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${expiresAt}T00:00:00`);
  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (daysLeft < 0) {
    return {
      state: "VENCIDA",
      label: "CNH vencida",
      tone: "bg-destructive/15 text-destructive border-destructive/30",
      apt: false,
      daysLeft,
    };
  }
  if (daysLeft <= CNH_WARNING_DAYS) {
    return {
      state: "PROXIMA",
      label: `CNH vence em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`,
      tone: "bg-warning/15 text-warning border-warning/30",
      apt: true,
      daysLeft,
    };
  }
  return {
    state: "VALIDA",
    label: "CNH válida",
    tone: "bg-success/15 text-success border-success/30",
    apt: true,
    daysLeft,
  };
}

export function fmtCpf(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
