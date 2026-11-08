// X5: dónde se declara el padrón que falta. La propuesta de padrón (graficos_padron_por_base.R) lee de dos fuentes, en
// este orden: Cálculo de muestra (el marco validado del componente del actor) y, si no, Monitoreo (el universo del
// reporte de avance de acreditación). Una base sin ninguna sale «Sin propuesta» y la lámina va sólo con los n: es un
// vacío legítimo, pero dice dónde declararlo. Los destinos son direcciones canónicas (navegación v3), nunca paths a mano.

import { serializarDireccion } from "../../../../lib/navegacion/direccion";
import { searchConPanel } from "../../../../lib/navegacion/paneles";
import type { PadronPropuesto } from "../../../../api/graficosPadron";
import { PANEL_ESTUDIO } from "../../../estudio/panelEstudio";

export type DestinoPadron = { clave: "calc-muestra" | "monitoreo" | "ficha"; texto: string; nombre: string; href: string };

/** La Ficha del estudio (`/?panel=estudio`), donde se declara el tipo que fija el modo de Cálculo de muestra. */
export const HREF_FICHA = `/${searchConPanel("", PANEL_ESTUDIO)}`;

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
 * Los módulos donde se declara. Cálculo de muestra con el modo del estudio; si el estudio ya se leyó y no tiene tipo
 * (R5-4: sin modo, Cálculo de muestra no sabe qué marco abrir), primero la Ficha del estudio, donde se declara. Mientras
 * carga, Cálculo de muestra sin modo. Monitoreo sólo si el estudio tiene su modo de acreditación, que es el único
 * reporte del que la propuesta lee el universo.
 */
/**
 * `para`: los públicos (bases) toman su padrón de Cálculo de muestra o Monitoreo; los grupos internos de un cruce no
 * tienen propuesta (la propuesta es por base), así que su padrón se teclea aquí y el enlace lleva al marco de Cálculo de
 * muestra para consultarlo. Monitoreo no se ofrece a los grupos: su universo es por actor, no por grupo.
 */
export function dondeDeclararPadron(modos: ModosDelEstudio, para: "publicos" | "grupos" = "publicos"): DestinoPadron[] {
  const calc = modos?.calc?.trim() || null;
  const grupos = para === "grupos";
  const destinos: DestinoPadron[] = modos && !calc
    ? [{ clave: "ficha", texto: "Declarar el tipo del estudio", nombre: "Declarar el tipo del estudio en la Ficha del estudio", href: HREF_FICHA }]
    : [{
      clave: "calc-muestra",
      texto: grupos ? "Ver el marco en Cálculo de muestra" : "Declarar en Cálculo de muestra",
      nombre: grupos ? "Ver el marco muestral en Cálculo de muestra" : "Declarar el padrón en Cálculo de muestra",
      href: serializarDireccion({ modulo: "calc-muestra", ...(calc ? { modo: calc } : {}) }),
    }];
  if (!grupos && modos?.monitoreo.includes("acreditacion")) {
    destinos.push({
      clave: "monitoreo",
      texto: destinos[0]?.clave === "ficha" ? "o declarar en Monitoreo" : "o en Monitoreo",
      nombre: "Declarar el padrón en Monitoreo de acreditación",
      href: serializarDireccion({ modulo: "monitoreo", modo: "acreditacion" }),
    });
  }
  return destinos;
}
