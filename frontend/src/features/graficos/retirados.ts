// Tipos de gráfico retirados por el ADR 0137. La ficha de cada uno —nombre legible y reemplazo sugerido— la sirve el
// registro (`retirados` de GET /api/graficos/registry, api/R/graficos_retirados.R). La fase 2 borró los tipos del
// catálogo y de la app; esta lista congelada queda como respaldo para reconocer un plan viejo aunque el registro llegue
// sin fichas (RanuraRetirada, avisos). Módulo puro.

import type { GraficadorMetadata, GraficadorRetirado } from "../../api/graficos";
import { graficadorDisplayName } from "./graficadorDisplay";

/** Nombre legible de los siete tipos del ADR 0137 (seis del ADR más el resto `p_dim_radar_tabla`). La fase 2 borró
 *  los tipos del registro, del catálogo y de los nombres de graficadorDisplay: un plan viejo que los traiga se
 *  reconoce y se nombra desde aquí, con los mismos títulos que api/R/graficos_retirados.R. */
export const NOMBRE_RETIRADO_0137: Readonly<Record<string, string>> = {
  p_significancia_publicos: "Diferencias significativas entre públicos",
  p_dim_radar: "Radar por dimensiones",
  p_dim_heatmap: "Heatmap de dimensiones",
  p_dim_heatmap_criterios: "Heatmap por criterios",
  p_dim_comparativo_radarbar: "Radar + barras comparativo",
  p_dim_foda: "Matriz FODA dimensional",
  p_dim_radar_tabla: "Radar + tabla de dimensiones",
};

/** Los siete tipos del ADR 0137. */
export const TIPOS_RETIRADOS_0137: ReadonlySet<string> = new Set(Object.keys(NOMBRE_RETIRADO_0137));

export const ADR_RETIRO = "0137";

type ConRetirados = { readonly retirados: readonly GraficadorRetirado[] } | null | undefined;

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
  return { name, titulo_humano: NOMBRE_RETIRADO_0137[name] ?? graficadorDisplayName(name), adr: ADR_RETIRO, reemplazo: { texto: "", graficador: "" } };
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

/** Título del tipo que reemplaza 1:1 al `p_dim_heatmap` con una pregunta como objetivo (api/R/graficos_heatmap_cruce.R). */
export const TITULO_MAPA_CALOR_CRUCE = "Mapa de calor por cruce";

/**
 * R11-3: el aviso de una ranura con un tipo retirado, con el texto de `.graficos_retirado_aviso_validacion`
 * (api/R/graficos_retirados.R) sin el rótulo de la lámina. `heatmapComoCruce`: el `p_dim_heatmap` cuyo objetivo y cruce
 * son preguntas del instrumento sale como el mapa de calor por cruce, con las mismas cifras.
 */
export function avisoTipoRetirado(
  espacio: string,
  ficha: Pick<GraficadorRetirado, "titulo_humano" | "reemplazo">,
  heatmapComoCruce = false,
): string {
  if (heatmapComoCruce) {
    return `el espacio "${espacio}" usa "${ficha.titulo_humano}", que ya no existe; sale como "${TITULO_MAPA_CALOR_CRUCE}", con las mismas cifras.`;
  }
  const reemplazo = ficha.reemplazo.texto.trim() || "otro tipo de gráfico";
  return `el espacio "${espacio}" usa "${ficha.titulo_humano}", que ya no existe; sale en blanco. Cámbialo por ${reemplazo}.`;
}
