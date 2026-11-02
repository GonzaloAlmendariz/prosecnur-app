/**
 * Avance › Ritmo, por público (pedido de Gonzalo, 29/10/2026: «faltan más
 * elementos visuales en el ritmo diario, como gráficos por actor»). El apilado
 * dice cuánto entra cada día entre todos; esto dice cómo va cada público frente
 * a su meta y a qué ritmo, para comparar de un vistazo quién se queda atrás.
 * Puro y con test.
 */

import { normalizeSourceMatch } from "../formato";
import type { SerieApilada } from "./ritmoModelo";
import { rowNumber, rowText } from "./tarjetasDeAvance";

export type RitmoDePublico = {
  publico: string;
  /** Posición de su capa en el apilado (1…7): el mismo color en los dos gráficos. */
  capa: number;
  /** Efectivas de los últimos `dias` días del corte, del más antiguo al más reciente. */
  ultimos: number[];
  efectivas: number;
  meta: number | null;
  /** Promedio diario de los últimos 7 días del corte (los días sin efectivas cuentan). */
  promedio7: number;
  /** Cuántos días entran en ese promedio: menos de 7 al empezar el campo. */
  diasDelPromedio: number;
  faltan: number | null;
  /** Días para llegar a la meta al ritmo de los últimos 7 días; null si no hay meta o ritmo. */
  diasALaMeta: number | null;
};

export function ritmoPorPublico(
  serie: SerieApilada,
  actores: ReadonlyArray<Record<string, unknown>>,
  dias = 14,
): RitmoDePublico[] {
  const metas = new Map<string, number>();
  for (const fila of actores) {
    const clave = normalizeSourceMatch(rowText(fila, ["Actor", "Unidad", "Público"], ""));
    const meta = rowNumber(fila, ["Meta", "Referencia operativa"], Number.NaN);
    if (clave && Number.isFinite(meta) && meta > 0) metas.set(clave, meta);
  }
  return serie.capas
    .map((capa, indice) => ({ capa, indice }))
    .map(({ capa, indice }) => {
      const meta = metas.get(normalizeSourceMatch(capa.publico)) ?? null;
      const siete = capa.valores.slice(-7);
      const promedio7 = siete.length ? siete.reduce((suma, valor) => suma + valor, 0) / siete.length : 0;
      const faltan = meta == null ? null : Math.max(0, meta - capa.total);
      const diasALaMeta = faltan == null ? null : faltan === 0 ? 0 : promedio7 > 0 ? Math.ceil(faltan / promedio7) : null;
      return {
        publico: capa.publico,
        capa: indice + 1,
        ultimos: capa.valores.slice(-dias),
        efectivas: capa.total,
        meta,
        promedio7,
        diasDelPromedio: siete.length,
        faltan,
        diasALaMeta,
      };
    })
    // Primero los que más lejos están de su meta.
    .sort((a, b) => avance(a) - avance(b) || a.publico.localeCompare(b.publico, "es"));
}

function avance(item: RitmoDePublico) {
  return item.meta ? item.efectivas / item.meta : Number.POSITIVE_INFINITY;
}
