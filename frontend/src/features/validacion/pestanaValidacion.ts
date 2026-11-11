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
// Regla especial: `pestana=instrumento&panel=regla&foco=<id>` abre Hallazgos,
// porque ese panel era el detalle de la regla con sus casos y ahora vive allí.

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

/** La clave canónica que nombra lo pedido, con alias resueltos; `null` si no nombra ninguna. */
export function clavePedidaValidacion(
  pedida: string | null | undefined,
  panel: string | null | undefined = null,
): ValidacionTabId | null {
  if (!pedida) return null;
  const limpia = normalizarToken(pedida);
  if (!limpia) return null;
  if (esClaveValidacion(limpia)) return limpia;
  if (limpia === "instrumento" && panel && normalizarToken(panel) === PANEL_REGLA_VALIDACION.id) {
    return "hallazgos";
  }
  if (Object.hasOwn(ALIAS_PESTANAS_VALIDACION, limpia)) {
    return ALIAS_PESTANAS_VALIDACION[limpia as keyof typeof ALIAS_PESTANAS_VALIDACION];
  }
  return null;
}

/** La pestaña que abre la dirección, o Explorar si no nombra ninguna válida. */
export function resolverPestanaValidacion(
  pedida: string | null | undefined,
  panel: string | null | undefined = null,
): ValidacionTabId {
  return clavePedidaValidacion(pedida, panel) ?? PESTANA_VALIDACION_POR_DEFECTO;
}

/**
 * El `search` con la pestaña escrita con su clave canónica, si la dirección la
 * nombraba con un alias. Lo usa quien escribe en la dirección (abrir o cerrar
 * el panel de la regla): sin esto, cerrar el panel en
 * `?pestana=instrumento&panel=regla` dejaría `?pestana=instrumento`, que abre
 * Reglas, y la vista saltaría de pestaña.
 */
export function searchConPestanaCanonica(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const pedida = params.get("pestana");
  if (!pedida) return search;
  const canonica = clavePedidaValidacion(pedida, params.get("panel"));
  if (!canonica || canonica === pedida) return search;
  return conNivel(search, "pestana", canonica);
}
