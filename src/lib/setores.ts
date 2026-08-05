/** Setores institucionais fixos da SRE. */
export const SECTORS = ["GABINETE", "DAFI", "DIRE", "DIPE", "NTE", "INSPEÇÃO"] as const;

export type Sector = (typeof SECTORS)[number];

export function isSector(value: unknown): value is Sector {
  return typeof value === "string" && (SECTORS as readonly string[]).includes(value);
}
