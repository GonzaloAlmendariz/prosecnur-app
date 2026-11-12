// Qué pestaña de Analítica abre una dirección (ADR 0144).
//
// Base final, Bases e instrumentos, Libro de códigos y Ficha técnica pasaron a
// Entrega el 2026-11-12. Un enlace guardado con la clave vieja sigue abriendo
// lo mismo: Entrega con ese entregable en foco. La clave vieja se LEE aquí y
// ningún código la escribe (`direccionesRenombradasNoSeEscriben.contract.test.ts`).
// `?reporte=` es el nombre viejo del parámetro y también se lee.

import { parsearDireccion } from "../../lib/navegacion/direccion";
import type { AnaliticaTabId } from "../../lib/navegacion/catalogos/procesamiento";
import type { EntregableId } from "./entrega/modeloDeEntrega";

export const PESTANA_ANALITICA_POR_DEFECTO = "datos" satisfies AnaliticaTabId;

/** Clave retirada → el entregable que la reemplaza dentro de Entrega. Solo se lee. */
export const ALIAS_PESTANAS_ANALITICA = {
  base_final: "base-final",
  // El parser global de direcciones escribe `_` como `-`.
  "base-final": "base-final",
  bases: "base-final",
  codebook: "libro",
  ficha: "ficha",
} as const satisfies Readonly<Record<string, EntregableId>>;

export type PedidoDeAnalitica = {
  /** La clave pedida, ya traducida si era un alias; `null` si la dirección no pide pestaña. */
  pestana: string | null;
  /** El entregable que pedía la clave vieja, para abrirlo en Entrega. */
  foco: EntregableId | null;
};

/** Lee la pestaña que pide la dirección, con los alias resueltos. */
export function pestanaPedidaAnalitica(search: string): PedidoDeAnalitica {
  // El parser compartido lee `pestana` y sus alias de Procesamiento (`reporte`) y escribe `_` como `-`.
  const cruda = parsearDireccion("/analitica", search)?.pestana?.trim() ?? "";
  if (!cruda) return { pestana: null, foco: null };
  if (Object.hasOwn(ALIAS_PESTANAS_ANALITICA, cruda)) {
    return { pestana: "entrega", foco: ALIAS_PESTANAS_ANALITICA[cruda as keyof typeof ALIAS_PESTANAS_ANALITICA] };
  }
  return { pestana: cruda, foco: null };
}
