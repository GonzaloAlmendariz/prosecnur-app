/**
 * La afijación del diseño viaja a la selección — el consumidor UI.
 *
 * El motor respeta `faculty_targets` (calc_muestra_aulas_afijacion.R): sin
 * declararlos, el sorteo reparte por masa de elegibles e ignora el
 * `aulas_base` POR FACULTAD que el propio cálculo publicó — medido en
 * HSVG2026: DERECHO diseño 18 → sorteo 36, ARQ 15 → 7, desvío 68/202. Este
 * módulo arma los targets desde los estratos del estudio y los inyecta en el
 * config que la UI manda al seleccionar, para que el analista no dependa de
 * un POST manual.
 *
 * Reglas: el target de una facultad es `margen.aulas_requeridas` si el motor
 * publicó margen, si no `aulas_base`; un valor no finito NO degrada a 0
 * (Number(null) es 0 — trampa del repo): la fila se salta. Sin estratos
 * utilizables el config vuelve INTACTO — retro-compat con estudios sin
 * cálculo por facultad.
 */
import type { CalcMuestraAulasEstrato, CalcMuestraWorkspaceAulasConfig } from "../../../../api/calcMuestra";

function objetivoDeFila(fila: CalcMuestraAulasEstrato): number | null {
  const margen = (fila as { margen?: { aulas_requeridas?: unknown } }).margen;
  for (const candidato of [margen?.aulas_requeridas, fila.aulas_base]) {
    if (typeof candidato === "number" && Number.isFinite(candidato) && candidato >= 0) {
      return Math.round(candidato);
    }
  }
  return null;
}

/** Mapa facultad → aulas del diseño, desde los estratos publicados por R. */
export function targetsDesdeEstratos(
  filas: CalcMuestraAulasEstrato[] | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const fila of filas ?? []) {
    const facultad = typeof fila?.estrato === "string" ? fila.estrato.trim() : "";
    if (!facultad) continue;
    const objetivo = objetivoDeFila(fila);
    if (objetivo == null) continue;
    out[facultad] = objetivo;
  }
  return out;
}

/** Config de selección con la afijación del estudio declarada. Sin estratos
 *  utilizables devuelve el MISMO config (identidad, no copia vacía). */
export function conAfijacionDelEstudio(
  config: CalcMuestraWorkspaceAulasConfig,
  filas: CalcMuestraAulasEstrato[] | null | undefined,
): CalcMuestraWorkspaceAulasConfig {
  const targets = targetsDesdeEstratos(filas);
  const total = Object.values(targets).reduce((acc, n) => acc + n, 0);
  if (!Object.keys(targets).length || total < 1) return config;
  return { ...config, faculty_targets: targets, n_aulas: total };
}
