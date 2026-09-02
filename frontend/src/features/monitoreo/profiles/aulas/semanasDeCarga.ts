import { fechaIsoReal } from "./agendaPorDia";
import type { FilaDeCarga } from "./cargaDeCampo";

/**
 * Las filas de fecha del calendario de carga, agrupadas en semanas de lunes a
 * domingo para el pager ‹ ›/«Hoy» (dictado en vivo 2026-09-02: «puede ser
 * scrolleable por semana»).
 *
 * El carril «por agendar» no es una semana —es el patrón de lo pendiente— y
 * queda fuera del agrupado: la vista lo pinta siempre. Una fecha imposible
 * («2026-09-31») no forma semana ni se pierde: va a `sinSemana` y la vista la
 * pinta en cualquier página, porque recortarla al paginar sería perder una
 * fila que la malla completa sí enseña.
 */

const MS_DIA = 86_400_000;

export type SemanaDeCarga = {
  /** «del 14/09 al 20/09» — el rango de la semana de calendario. */
  etiqueta: string;
  /** Lunes de la semana, en ISO: la clave de orden. */
  lunes: string;
  /** Índices (en `malla.filas`) de las fechas que caen en esta semana. */
  indices: number[];
};

const ddmm = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const comoISO = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** El lunes (ms UTC-mediodía) de la semana de una fecha real, o null. */
const lunesDe = (iso: string): number | null => {
  const partes = fechaIsoReal(iso);
  if (!partes) return null;
  const ms = partes.fecha.getTime();
  return ms - ((partes.fecha.getUTCDay() + 6) % 7) * MS_DIA;
};

export function semanasDeCarga(
  filas: ReadonlyArray<FilaDeCarga>,
): { semanas: SemanaDeCarga[]; sinSemana: number[] } {
  const porLunes = new Map<number, number[]>();
  const sinSemana: number[] = [];
  filas.forEach((fila, i) => {
    if (fila.porAgendar || !fila.fecha) return;
    const lunes = lunesDe(fila.fecha);
    if (lunes === null) {
      sinSemana.push(i);
      return;
    }
    const grupo = porLunes.get(lunes);
    if (grupo) grupo.push(i);
    else porLunes.set(lunes, [i]);
  });

  const semanas = [...porLunes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lunes, indices]) => ({
      etiqueta: `del ${ddmm(lunes)} al ${ddmm(lunes + 6 * MS_DIA)}`,
      lunes: comoISO(lunes),
      indices,
    }));

  return { semanas, sinSemana };
}

/**
 * Dónde abre el pager: en la semana que contiene HOY, o en la primera. `hoy`
 * entra como ISO para que el cálculo sea puro; el reloj lo consulta la vista.
 */
export function semanaInicial(semanas: ReadonlyArray<SemanaDeCarga>, hoy: string): number {
  const lunesHoy = lunesDe(hoy);
  if (lunesHoy !== null) {
    const i = semanas.findIndex((s) => s.lunes === comoISO(lunesHoy));
    if (i >= 0) return i;
  }
  return 0;
}
