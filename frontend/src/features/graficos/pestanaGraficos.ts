// Pestaña activa de Procesamiento › Gráficos (F6). La lee `useSeccion("procesamiento")`; aquí sólo se resuelve contra
// el catálogo: sin pestaña, o con una que no existe, se abre «Láminas».

import { PROCESAMIENTO_PESTANAS, type GraficosTabId } from "../../lib/navegacion/catalogos/procesamiento";
import { normalizarToken } from "../../lib/navegacion/direccion";

export type { GraficosTabId };
export const PESTANAS_GRAFICOS = PROCESAMIENTO_PESTANAS.graficos;
export const PESTANA_GRAFICOS_POR_DEFECTO: GraficosTabId = "laminas";

export function resolverPestanaGraficos(pedida: string | null | undefined): GraficosTabId {
  const token = normalizarToken(pedida ?? "");
  return PESTANAS_GRAFICOS.find((p) => normalizarToken(p.key) === token)?.key ?? PESTANA_GRAFICOS_POR_DEFECTO;
}
