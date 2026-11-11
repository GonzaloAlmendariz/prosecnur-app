// Qué pestaña de Validación abre una dirección (ADR 0142, rebanada V2 de P6).
//
// Las claves de Validación cambiaron el 2026-11-11: "Reglas del formulario"
// (`instrumento`) y "Criterios de revisión" (`reglas_custom`) se juntan en
// Reglas, y "Cierre de base" (`limpieza`) se parte en Hallazgos (la cola y su
// decisión) y Cierre (la base limpia). Un enlace guardado con la clave vieja
// sigue abriendo su pestaña: la clave se LEE aquí y la dirección no se
// reescribe al abrir. Ningún código escribe una clave vieja
// (`direccionesRenombradasNoSeEscriben.contract.test.ts`).
//
// Regla especial (plan de fidelidad, rebanada V0): `pestana=instrumento&panel=
// regla&foco=<id>` era el detalle de una regla del formulario. Abre Reglas con
// `foco=<id>` (la ficha de la regla, V1). `panel=regla` quedó para el editor de
// reglas propias, así que en ese enlace viejo no se lee como panel: cuando la
// pestaña escribe en la dirección, el panel se va y el foco se queda. Antes
// (rebanada V2 de P6) este enlace abría Hallazgos.

import { PROCESAMIENTO_PESTANAS, type ValidacionTabId } from "../../lib/navegacion/catalogos/procesamiento";
import { normalizarToken, conNivel } from "../../lib/navegacion/direccion";
import { PANEL_REGLA_VALIDACION } from "./panelesValidacion";

export const PESTANA_VALIDACION_POR_DEFECTO = "explorar" satisfies ValidacionTabId;

/**
 * Clave vieja → pestaña que la reemplaza. Solo se lee. Las claves van ya
 * normalizadas (`normalizarToken`: minúsculas y `_` como `-`), que es como
 * vuelven de la dirección; `reglas_custom` se escribe aquí con guion.
 */
export const ALIAS_PESTANAS_VALIDACION = {
  instrumento: "reglas",
  "reglas-custom": "reglas",
  limpieza: "hallazgos",
} as const satisfies Readonly<Record<string, ValidacionTabId>>;

const CLAVES_VALIDACION: readonly string[] = PROCESAMIENTO_PESTANAS.validacion.map((tab) => tab.key);

function esClaveValidacion(valor: string): valor is ValidacionTabId {
  return CLAVES_VALIDACION.includes(valor);
}

/**
 * `true` si la dirección es el enlace viejo al detalle de una regla del
 * formulario (`pestana=instrumento&panel=regla`): ese `panel` no abre el
 * editor, y su `foco` es la regla que la ficha de Reglas muestra.
 */
export function esAliasDelDetalleDeRegla(
  pedida: string | null | undefined,
  panel: string | null | undefined,
): boolean {
  if (!pedida || !panel) return false;
  return normalizarToken(pedida) === "instrumento" && normalizarToken(panel) === PANEL_REGLA_VALIDACION.id;
}

/** La clave canónica que nombra lo pedido, con alias resueltos; `null` si no nombra ninguna. */
export function clavePedidaValidacion(pedida: string | null | undefined): ValidacionTabId | null {
  if (!pedida) return null;
  const limpia = normalizarToken(pedida);
  if (!limpia) return null;
  if (esClaveValidacion(limpia)) return limpia;
  if (Object.hasOwn(ALIAS_PESTANAS_VALIDACION, limpia)) {
    return ALIAS_PESTANAS_VALIDACION[limpia as keyof typeof ALIAS_PESTANAS_VALIDACION];
  }
  return null;
}

/** La pestaña que abre la dirección, o Explorar si no nombra ninguna válida. Ningún panel cambia la pestaña de un alias. */
export function resolverPestanaValidacion(pedida: string | null | undefined): ValidacionTabId {
  return clavePedidaValidacion(pedida) ?? PESTANA_VALIDACION_POR_DEFECTO;
}

/**
 * El `search` con la pestaña escrita con su clave canónica, si la dirección la
 * nombraba con un alias. Lo usa quien escribe en la dirección: un enlace viejo
 * se lee tal cual al abrir y se escribe canónico en cuanto la vista escribe.
 * El enlace viejo al detalle de una regla pierde además `panel=regla`, que
 * ahora es el editor, y conserva `foco`.
 */
export function searchConPestanaCanonica(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const pedida = params.get("pestana");
  if (!pedida) return search;
  const canonica = clavePedidaValidacion(pedida);
  if (!canonica || canonica === pedida) return search;
  const conPestana = conNivel(search, "pestana", canonica);
  return esAliasDelDetalleDeRegla(pedida, params.get("panel")) ? conNivel(conPestana, "panel", null) : conPestana;
}
