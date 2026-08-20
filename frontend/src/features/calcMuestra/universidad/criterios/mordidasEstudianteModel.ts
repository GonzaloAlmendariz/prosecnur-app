/**
 * Cuánto recorta cada criterio de estudiante — el resumen que faltaba arriba
 * de las tarjetas (M8, vara de mejora continua).
 *
 * Cada criterio se mide SOLO (filas que pasan ese criterio contra el total de
 * filas de matrícula): las mordidas no se suman entre sí. El acumulado real lo
 * dice el pie con el dato del motor. La CAPA importa y se declara: los de
 * capa «marco» recortan el marco muestral; los de capa «instrumento» actúan
 * al encuestar (dentro del aula), no reducen el marco.
 */
export type MordidaCriterio = {
  clave: string;
  etiqueta: string;
  capa: "marco" | "instrumento" | string;
  pasan: number;
  fuera: number;
  pctFuera: number;
};

const ETIQUETAS: Record<string, string> = {
  formation: "Formación",
  condition: "Condición de matrícula",
  faculty: "Facultad",
  age: "Edad",
  level: "Ciclo o nivel curricular",
  sex: "Sexo",
};

type ReporteCriterios = {
  activa?: unknown;
  filas_total?: unknown;
  criterios?: Record<string, { layer?: unknown; filas_pasan?: unknown; evaluable?: unknown }>;
} | null | undefined;

export function mordidasEstudiante(reporte: ReporteCriterios): {
  filasTotal: number;
  mordidas: MordidaCriterio[];
} | null {
  const total = Number(reporte?.filas_total);
  const criterios = reporte?.criterios;
  if (!reporte?.activa || !Number.isFinite(total) || total <= 0 || !criterios) return null;
  const mordidas: MordidaCriterio[] = [];
  for (const [clave, c] of Object.entries(criterios)) {
    if (c?.evaluable === false) continue;
    const pasan = Number(c?.filas_pasan);
    if (!Number.isFinite(pasan)) continue;
    const fuera = Math.max(0, total - pasan);
    mordidas.push({
      clave,
      etiqueta: ETIQUETAS[clave] ?? clave,
      capa: String(c?.layer ?? ""),
      pasan,
      fuera,
      pctFuera: (fuera / total) * 100,
    });
  }
  mordidas.sort((a, b) => b.fuera - a.fuera);
  return mordidas.length ? { filasTotal: total, mordidas } : null;
}
