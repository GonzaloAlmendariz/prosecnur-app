/**
 * Tasas de efectividad por facultad — el bloque que el motor publica en
 * `frame.tasas_efectividad_facultad` (plan 1b/E3: un solo dueño; nadie
 * recalcula en el front).
 *
 * Normalizador defensivo (patrón normalizeGraficosShareInspect): el payload
 * cruza R→JSON→TS y cualquier fila coja se descarta entera en vez de
 * propagar un NaN a la tarjeta didáctica.
 */

export type CalcMuestraTasaFacultad = {
  facultad: string;
  /** Tasa de efectividad de la facultad (0-1): Σ el·R·F / Σ el de su marco elegible. */
  tasa: number;
  n_aulas: number;
  elegibles: number;
  /** true = lleva residual medido del histórico; false = derivada de su mix. */
  con_residual: boolean;
  /** Aulas aplicadas de la facultad en el histórico; null = sin base propia. */
  facultad_k: number | null;
};

const num = (v: unknown): number | null => {
  // Number(null) === 0: un "sin dato" JSON se volveria un cero con
  // significado. null/undefined/"" son ausencia, no cero.
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function normalizeCalcMuestraTasasFacultad(raw: unknown): CalcMuestraTasaFacultad[] {
  if (!Array.isArray(raw)) return [];
  const out: CalcMuestraTasaFacultad[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const facultad = String(r.facultad ?? "").trim();
    const tasa = num(r.tasa);
    const nAulas = num(r.n_aulas);
    const elegibles = num(r.elegibles);
    if (!facultad || tasa == null || tasa <= 0 || tasa > 2) continue;
    const k = num(r.facultad_k);
    out.push({
      facultad,
      tasa,
      n_aulas: nAulas != null ? Math.max(0, Math.round(nAulas)) : 0,
      elegibles: elegibles != null ? Math.max(0, Math.round(elegibles)) : 0,
      con_residual: r.con_residual === true,
      facultad_k: k != null ? Math.round(k) : null,
    });
  }
  return out;
}
