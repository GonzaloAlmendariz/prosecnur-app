// Word, Gráficos (O7a del rediseño, 2026-10-15; decisiones O1 a O4 de Gonzalo): sólo lo que el Word hace distinto de la
// lámina. El inventario mostró que casi todos los ajustes por tipo del Word no cambian el documento (las figuras se
// dibujan desde la descripción del gráfico con el estándar) y que algunos lo dañan: decimales y método pisaban Reglas
// sólo en el Word, `tipo_pie` volvía donas las tortas, `bins` y `ancho_bin` mandaban el histograma a imagen. Puro.

import type { Slide } from "../../../api/graficos";
import { graficadorToPresetType } from "../graficadorPresetMap";
import { SLIDE_GRAF_SLOTS } from "../store";

export type AjusteWord = { arg: string; rotulo: string; ayuda: string; tipo: "bool" | "number" | "choice"; unidad?: string };

/** Los ajustes del Word que tienen efecto en el documento, por tipo de gráfico. Un tipo ausente sale como en la lámina. */
export const AJUSTES_WORD: Readonly<Record<string, readonly AjusteWord[]>> = {
  // La barra extra ya no es un ajuste del informe en el Word: el Word usa la misma que el PPT (`barra_extra`) y cada
  // gráfico puede cambiarla sólo para el Word con `word_barra_extra` (tarjeta del gráfico, «En el Word»).
  radar_tabla: [
    { arg: "tabla_body_size", rotulo: "Letra de la tabla", ayuda: "Tamaño del texto de las filas.", tipo: "number", unidad: "pt" },
    { arg: "tabla_firstcol_bold", rotulo: "Primera columna en negrita", ayuda: "Los nombres de cada fila.", tipo: "bool" },
    { arg: "umbral_rojo_pct", rotulo: "Resaltar en rojo por debajo de", ayuda: "Cero desactiva el resaltado.", tipo: "number", unidad: "%" },
  ],
  dim_heatmap_criterios: [{ arg: "fontface_texto_criterio", rotulo: "Peso del texto del criterio", ayuda: "Cómo se escribe cada criterio en la tabla.", tipo: "choice" }],
};

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Los tipos de gráfico (preset) que usa el informe, en el orden en que aparecen. */
export function tiposDelInforme(slides: readonly Slide[]): string[] {
  const vistos: string[] = [];
  for (const s of slides) {
    const payload = (s.payload ?? {}) as Record<string, unknown>;
    for (const slot of SLIDE_GRAF_SLOTS[s.tipo] ?? []) {
      const ref = payload[slot];
      const g = esObjeto(ref) && typeof ref.graficador === "string" ? ref.graficador : "";
      const tipo = g ? graficadorToPresetType(g) : null;
      if (tipo && !vistos.includes(tipo)) vistos.push(tipo);
    }
  }
  return vistos;
}

export type Sobrante = { tipo: string; arg: string };

/** Decisiones del Word guardadas en el proyecto que ya no se ofrecen. Siguen aplicándose hasta quitarlas: se avisan. */
export function ajustesSobrantes(decisiones: Record<string, Record<string, unknown>>): Sobrante[] {
  return Object.entries(decisiones).flatMap(([tipo, args]) => {
    const validos = new Set((AJUSTES_WORD[tipo] ?? []).map((a) => a.arg));
    return Object.keys(args).filter((arg) => !validos.has(arg)).map((arg) => ({ tipo, arg }));
  });
}

/** Devuelve cada sobrante a su valor por defecto (o lo quita si no tiene): así deja de ser una decisión. */
export function sinSobrantes(
  chartPresets: Record<string, Record<string, unknown>>,
  defaults: Record<string, Record<string, unknown>>,
  sobrantes: readonly Sobrante[],
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = { ...chartPresets };
  for (const { tipo, arg } of sobrantes) {
    const actual = { ...(out[tipo] ?? {}) };
    const def = defaults[tipo] ?? {};
    if (arg in def) actual[arg] = def[arg]; else delete actual[arg];
    out[tipo] = actual;
  }
  return out;
}
