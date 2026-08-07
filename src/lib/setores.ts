/** Setores institucionais fixos da SRE. */
export const SECTORS = ["GABINETE", "DAFI", "DIRE", "DIPE", "NTE", "INSPEÇÃO"] as const;

export type Sector = (typeof SECTORS)[number];

export function isSector(value: unknown): value is Sector {
  return typeof value === "string" && (SECTORS as readonly string[]).includes(value);
}

/**
 * Cor de identificação de cada setor no calendário.
 * As classes usam tokens semânticos declarados em src/styles.css.
 */
interface SectorColor {
  /** Faixa/ponto sólido. */
  dot: string;
  /** Fundo suave do evento. */
  chip: string;
  /** Texto do evento. */
  text: string;
  /** Borda lateral do evento. */
  border: string;
}

const COLORS: Record<string, SectorColor> = {
  GABINETE: {
    dot: "bg-sector-gabinete",
    chip: "bg-sector-gabinete/12",
    text: "text-sector-gabinete",
    border: "border-l-sector-gabinete",
  },
  DAFI: {
    dot: "bg-sector-dafi",
    chip: "bg-sector-dafi/12",
    text: "text-sector-dafi",
    border: "border-l-sector-dafi",
  },
  DIRE: {
    dot: "bg-sector-dire",
    chip: "bg-sector-dire/12",
    text: "text-sector-dire",
    border: "border-l-sector-dire",
  },
  DIPE: {
    dot: "bg-sector-dipe",
    chip: "bg-sector-dipe/12",
    text: "text-sector-dipe",
    border: "border-l-sector-dipe",
  },
  NTE: {
    dot: "bg-sector-nte",
    chip: "bg-sector-nte/12",
    text: "text-sector-nte",
    border: "border-l-sector-nte",
  },
  "INSPEÇÃO": {
    dot: "bg-sector-inspecao",
    chip: "bg-sector-inspecao/12",
    text: "text-sector-inspecao",
    border: "border-l-sector-inspecao",
  },
};

const FALLBACK: SectorColor = {
  dot: "bg-sector-outro",
  chip: "bg-sector-outro/12",
  text: "text-sector-outro",
  border: "border-l-sector-outro",
};

export function sectorColor(sector: string | null | undefined): SectorColor {
  if (!sector) return FALLBACK;
  return COLORS[sector] ?? FALLBACK;
}
