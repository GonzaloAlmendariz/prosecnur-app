// Pestaña activa de Procesamiento › Gráficos (F6). La lee `useSeccion("procesamiento")`; aquí sólo se resuelve contra
// el catálogo: sin pestaña, o con una que no existe, se abre «Láminas».

import { PROCESAMIENTO_PESTANAS, type GraficosTabId } from "../../lib/navegacion/catalogos/procesamiento";
import { normalizarToken } from "../../lib/navegacion/direccion";

export type { GraficosTabId };
export const PESTANAS_GRAFICOS = PROCESAMIENTO_PESTANAS.graficos;
export const PESTANA_GRAFICOS_POR_DEFECTO: GraficosTabId = "laminas";

/** Claves de antes del rediseño (2026-10-14, D1): un enlace viejo abre la pestaña nueva; nunca se escriben. */
export const ALIAS_PESTANAS_GRAFICOS: Readonly<Record<string, GraficosTabId>> = {
  "vista-general": "informe",
  "estilo": "identidad",
  "estilo-informe": "reglas",
};

export function resolverPestanaGraficos(pedida: string | null | undefined): GraficosTabId {
  const token = normalizarToken(pedida ?? "");
  const canonica = PESTANAS_GRAFICOS.find((p) => normalizarToken(p.key) === token)?.key;
  if (canonica) return canonica;
  const alias = Object.entries(ALIAS_PESTANAS_GRAFICOS).find(([vieja]) => normalizarToken(vieja) === token)?.[1];
  return alias ?? PESTANA_GRAFICOS_POR_DEFECTO;
}
