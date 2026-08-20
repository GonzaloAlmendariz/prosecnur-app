/**
 * La distribución de elegibles por aula, por facultad — el dato que el P25
 * resume y que dimensiona el estudio.
 *
 * Vara de mejora continua (Gonzalo, 2026-08-19): el P25 rige cuántas aulas
 * necesita cada facultad (cuota ÷ (P25 × τ)) pero era INVISIBLE en la UI — la
 * confusión P25-vs-media de hoy no habría existido con esta distribución en
 * pantalla. Cuantiles con interpolación tipo 7 (la de R), igual que el motor;
 * la tarjeta lo declara referencial: el número que rige es el del estrato.
 */
type FilaAula = Record<string, unknown>;

export type DistribucionFacultad = {
  clave: string;
  facultad: string;
  nAulas: number;
  min: number;
  p25: number;
  mediana: number;
  p75: number;
  max: number;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Cuantil con interpolación tipo 7 (default de R) sobre valores ya ordenados. */
export function cuantilTipo7(ordenados: number[], q: number): number {
  if (!ordenados.length) return 0;
  const h = (ordenados.length - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, ordenados.length - 1);
  return ordenados[lo] + (h - lo) * (ordenados[hi] - ordenados[lo]);
}

/**
 * Distribución por facultad de los elegibles por aula INCLUIDA en el marco.
 * Ordenada por P25 ascendente: la historia que cuenta es «las facultades de
 * aulas chicas necesitan más aulas para la misma cuota».
 */
export function distribucionElegibles(aulaFrame: FilaAula[] | null | undefined): DistribucionFacultad[] {
  const porFacultad = new Map<string, number[]>();
  for (const a of aulaFrame ?? []) {
    if (a.included !== true) continue;
    const facultad = String(a.faculty ?? "").trim();
    const n = num(a.eligible_n);
    if (!facultad || n == null) continue;
    const vals = porFacultad.get(facultad) ?? [];
    vals.push(n);
    porFacultad.set(facultad, vals);
  }
  const filas: DistribucionFacultad[] = [];
  for (const [facultad, vals] of porFacultad) {
    vals.sort((a, b) => a - b);
    filas.push({
      clave: facultad,
      facultad,
      nAulas: vals.length,
      min: vals[0],
      p25: cuantilTipo7(vals, 0.25),
      mediana: cuantilTipo7(vals, 0.5),
      p75: cuantilTipo7(vals, 0.75),
      max: vals[vals.length - 1],
    });
  }
  filas.sort((a, b) => a.p25 - b.p25);
  return filas;
}
