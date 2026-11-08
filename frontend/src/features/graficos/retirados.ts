// Tipos de gráfico retirados por el ADR 0137 (fase 1: compatibilidad, sin borrar nada). La ficha de cada uno —nombre
// legible y reemplazo sugerido— la sirve el registro (`retirados` de GET /api/graficos/registry, api/R/graficos_retirados.R).
// El catálogo versionado los sigue trayendo con `en_selector` intacto, así que el selector necesita saber por nombre qué
// no ofrecer aunque el registro llegue de un backend anterior: de ahí la lista congelada de abajo. La fase 2 la borra
// junto con los tipos. Módulo puro.

import type { GraficadorMetadata, GraficadorRetirado, Registry } from "../../api/graficos";
import { graficadorDisplayName } from "./graficadorDisplay";

/** Los siete tipos del ADR 0137 (seis del ADR más el resto `p_dim_radar_tabla`). */
export const TIPOS_RETIRADOS_0137: ReadonlySet<string> = new Set([
  "p_significancia_publicos",
  "p_dim_radar",
  "p_dim_heatmap",
  "p_dim_heatmap_criterios",
  "p_dim_comparativo_radarbar",
  "p_dim_foda",
  "p_dim_radar_tabla",
]);

export const ADR_RETIRO = "0137";

type ConRetirados = Pick<Registry, "retirados"> | null | undefined;

/** ¿El tipo está retirado? Lo dice el registro o, sin él, la lista congelada. */
export function esTipoRetirado(name: string | null | undefined, registry?: ConRetirados): boolean {
  if (!name) return false;
  return TIPOS_RETIRADOS_0137.has(name) || !!registry?.retirados.some((r) => r.name === name);
}

/** La ficha del retirado: la del registro y, si no llegó, una mínima con su nombre legible y sin reemplazo. */
export function fichaRetirado(name: string, registry?: ConRetirados): GraficadorRetirado | null {
  const delRegistro = registry?.retirados.find((r) => r.name === name);
  if (delRegistro) return delRegistro;
  if (!TIPOS_RETIRADOS_0137.has(name)) return null;
  return { name, titulo_humano: graficadorDisplayName(name), adr: ADR_RETIRO, reemplazo: { texto: "", graficador: "" } };
}

/** Lo que dice el detalle (tooltip) del aviso: la única parte que cita el ADR. */
export function detalleRetiro(ficha: Pick<GraficadorRetirado, "adr">): string {
  const adr = ficha.adr || ADR_RETIRO;
  return `Retirado por el ADR ${adr}. El plan conserva el tipo y sus datos; en el informe esta ranura sale en blanco hasta que lo cambies.`;
}

/** «Reemplazo: Media y rango sobre la columna del índice.»; sin texto, null. */
export function textoReemplazo(ficha: Pick<GraficadorRetirado, "reemplazo">): string | null {
  const t = ficha.reemplazo.texto.trim().replace(/\.+$/, "");
  return t ? `Reemplazo: ${t.charAt(0).toLocaleUpperCase("es")}${t.slice(1)}.` : null;
}

/**
 * El tipo por el que se ofrece cambiar con un clic: el `reemplazo.graficador` si no está vacío, lo trae el registro de
 * esta sesión y no está retirado él mismo. Si no, null y queda sólo el selector de tipo.
 */
export function reemplazoDirecto(
  ficha: Pick<GraficadorRetirado, "reemplazo">,
  graficadoresById: Readonly<Record<string, Pick<GraficadorMetadata, "name" | "titulo_humano">>>,
): { graficador: string; nombre: string } | null {
  const g = ficha.reemplazo.graficador.trim();
  if (!g || TIPOS_RETIRADOS_0137.has(g)) return null;
  const meta = graficadoresById[g];
  if (!meta) return null;
  return { graficador: g, nombre: graficadorDisplayName(g, meta) };
}
