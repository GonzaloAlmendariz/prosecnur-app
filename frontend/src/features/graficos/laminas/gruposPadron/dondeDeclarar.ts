// X5: dónde se declara el padrón que falta. La propuesta de padrón (graficos_padron_por_base.R) lee de dos fuentes, en
// este orden: Cálculo de muestra (el marco validado del componente del actor) y, si no, Monitoreo (el universo del
// reporte de avance de acreditación). Una base sin ninguna sale «Sin propuesta» y la lámina va sólo con los n: es un
// vacío legítimo, pero dice dónde declararlo. Los destinos son direcciones canónicas (navegación v3), nunca paths a mano.

import { serializarDireccion } from "../../../../lib/navegacion/direccion";
import type { PadronPropuesto } from "../../../../api/graficosPadron";

export type DestinoPadron = { clave: "calc-muestra" | "monitoreo"; texto: string; nombre: string; href: string };

/** Lo que el estudio fija en cada módulo (`/api/planner/modos`); `null` mientras carga. */
export type ModosDelEstudio = { calc: string | null; monitoreo: readonly string[] } | null;

/**
 * ¿Hay un público incluido que se queda sin padrón? Sin padrón escrito en la lámina y sin propuesta que lo traiga.
 * `escrito`: el padrón que la lámina ya lleva para ese público (`padronDe`).
 */
export function faltaPadron(publicos: readonly { incluido: boolean; escrito: number | null; propuesta: PadronPropuesto | null }[]): boolean {
  return publicos.some((p) => p.incluido && p.escrito === null && (p.propuesta?.padron ?? null) === null);
}

/**
 * Los módulos donde se declara. Cálculo de muestra siempre (con el modo del estudio cuando se conoce); Monitoreo sólo si
 * el estudio tiene su modo de acreditación, que es el único reporte del que la propuesta lee el universo.
 */
export function dondeDeclararPadron(modos: ModosDelEstudio): DestinoPadron[] {
  const calc = modos?.calc ?? null;
  const destinos: DestinoPadron[] = [{
    clave: "calc-muestra",
    texto: "Declarar en Cálculo de muestra",
    nombre: "Declarar el padrón en Cálculo de muestra",
    href: serializarDireccion({ modulo: "calc-muestra", ...(calc ? { modo: calc } : {}) }),
  }];
  if (modos?.monitoreo.includes("acreditacion")) {
    destinos.push({
      clave: "monitoreo",
      texto: "o en Monitoreo",
      nombre: "Declarar el padrón en Monitoreo de acreditación",
      href: serializarDireccion({ modulo: "monitoreo", modo: "acreditacion" }),
    });
  }
  return destinos;
}
