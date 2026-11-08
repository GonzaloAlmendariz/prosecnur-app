// Lo que dice la cabecera de una sección plegada de la tarjeta (ítem 12 de la oleada del inspector, 2026-11-08): cuántos
// ajustes de adentro son propios de este gráfico (distintos de los de su tipo), para saber sin abrirla si hay algo que
// mirar. Sale de los `propios` de DatosGrafico agrupados por sección (gruposTarjeta.ts). Puro.

import { formatoConteo } from "../../../../lib/formatoNumero";

export type ResumenPlegado = { texto: string; detalle: string };

/** Un rótulo corto se nombra («Redondeo propio»); uno largo o varios, se cuentan («2 propios»). */
const NOMBRABLE = 20;

export function resumenPlegado(rotulos: readonly string[]): ResumenPlegado | null {
  const unicos = [...new Set(rotulos.map((r) => r.trim()).filter(Boolean))];
  if (!unicos.length) return null;
  const detalle = `Sólo de este gráfico: ${unicos.join(", ")}.`;
  if (unicos.length === 1) return { texto: unicos[0].length <= NOMBRABLE ? `${unicos[0]} propio` : "1 propio", detalle };
  return { texto: `${formatoConteo(unicos.length)} propios`, detalle };
}
