import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";

/**
 * Cuánto le falta a cada celda de cuota sexo×facultad.
 *
 * Es la única vista del catálogo que mira **dentro** de la muestra en vez de
 * contar aulas: dos facultades pueden ir igual de bien en respuestas y una tener
 * la cuota de mujeres a cero. Por eso el eje es el **cumplimiento**, no el
 * volumen —cada celda tiene su propia meta, y 40 de 50 y 4 de 5 son el mismo
 * problema resuelto en la misma proporción—.
 */

/** El color sale del veredicto que ya emite el motor, no de recalcularlo aquí. */
const TONO_POR_ESTADO: Record<string, string> = {
  cumplida: COLOR_RESULTADO.efectiva,
  en_riesgo: COLOR_RESULTADO.parcial,
  pendiente: COLOR_RESULTADO.pendiente,
};

export type CeldaDeCuota = {
  /** «Facultad · Sexo», tal como se lee en el eje. */
  etiqueta: string;
  /** Cumplimiento en puntos porcentuales; puede pasar de 100. */
  avance: number;
  /** Respuestas que faltan para la meta de la celda. */
  faltan: number;
  observadas: number;
  meta: number;
  estado: string;
  color: string;
};

function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Ordena las celdas por cumplimiento ascendente: la peor arriba.
 *
 * Una celda **sin meta** (`status = "sin_meta"`) no entra en el reparto: su
 * cumplimiento no está definido y ponerla en 0 % o en 100 % serían dos mentiras
 * distintas —el mismo criterio que en el histograma de cobertura—. Se cuenta en
 * `sinMeta` y se dice bajo el gráfico.
 */
export function cuotasSexoFacultad(filas: ReadonlyArray<MonitoreoRow>, limite = 14) {
  const celdas: CeldaDeCuota[] = [];
  let sinMeta = 0;

  for (const fila of filas) {
    const facultad = texto(fila.faculty);
    const sexo = texto(fila.sex);
    const meta = numero(fila.target);
    const estado = texto(fila.status);
    if (estado === "sin_meta" || meta <= 0) { sinMeta += 1; continue; }
    const observadas = numero(fila.observed);
    celdas.push({
      etiqueta: [facultad, sexo].filter(Boolean).join(" · ") || "Sin identificar",
      // `progress_pct` puede llegar nulo aunque haya meta; se recalcula en vez
      // de dejar la barra en cero, que se leería como «no hay ni una».
      avance: Math.round((100 * observadas) / meta * 10) / 10,
      faltan: numero(fila.missing) || Math.max(0, meta - observadas),
      observadas,
      meta,
      estado,
      color: TONO_POR_ESTADO[estado] ?? COLOR_RESULTADO.pendiente,
    });
  }

  celdas.sort((a, b) => (a.avance - b.avance)
    || (b.faltan - a.faltan)
    || a.etiqueta.localeCompare(b.etiqueta, "es"));

  const visibles = celdas.slice(0, limite);
  const resto = celdas.slice(limite);
  return {
    celdas: visibles,
    omitidas: resto.length,
    sinMeta,
    cumplidas: celdas.filter((c) => c.estado === "cumplida").length,
    faltanTotal: celdas.reduce((suma, c) => suma + c.faltan, 0),
    total: celdas.length,
  };
}
