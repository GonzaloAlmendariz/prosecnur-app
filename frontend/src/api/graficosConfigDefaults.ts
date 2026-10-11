import {
  createDefaultWordPresets,
  normalizeDocumentoWord,
  wordPresetsDecisiones,
  type DocumentoWordOpciones,
} from "./graficosConfigNormalizer";

// ADR 0094 §6: `GET /api/graficos/config` devuelve, como hermano de `config`, los defaults declarados por el backend
// (`{ config, defaults: { w_presets, documento_word } }`). Son aditivos y no se persisten: sirven para que «Modificado»
// (decisión 5a) compare contra la autoridad del backend y no contra el espejo del frontend.

export type GraficosConfigDefaults = {
  w_presets: Record<string, Record<string, unknown>> | null;
  documento_word: DocumentoWordOpciones | null;
};

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

// Cada bloque (`chart_options`, `chart_presets`) debe ser objeto; `[]` (lista R vacía) cuenta como `{}` y lo demás se
// descarta.
function normalizeBloques(value: unknown): Record<string, Record<string, unknown>> | null {
  if (!isObj(value)) return null;
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, block] of Object.entries(value)) {
    if (isObj(block)) out[key] = block;
    else if (Array.isArray(block) && block.length === 0) out[key] = {};
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Lee `defaults` de la respuesta del GET. Ausente o malformado → `null`, y quien lo consume cae al espejo local
 * (`DEFAULT_WORD_PRESETS`). Un `w_presets` que no es objeto anula sólo esa rama.
 */
export function normalizeGraficosConfigDefaults(response: unknown): GraficosConfigDefaults | null {
  if (!isObj(response) || !isObj(response.defaults)) return null;
  const raw = response.defaults;
  const wPresets = normalizeBloques(raw.w_presets);
  const documentoWord = isObj(raw.documento_word) ? normalizeDocumentoWord(raw.documento_word) : null;
  if (!wPresets && !documentoWord) return null;
  return { w_presets: wPresets, documento_word: documentoWord };
}

/** Referencia para «Modificado» (decisión 5a): los defaults del backend si llegaron, si no el espejo local. */
export function resolveWordPresetsDefaults(
  defaults: GraficosConfigDefaults | null,
): Record<string, Record<string, unknown>> {
  return defaults?.w_presets ?? createDefaultWordPresets();
}

/**
 * Por tipo de gráfico, sólo los argumentos del Word que difieren de la referencia. Un tipo ausente del resultado está
 * «Del recetario»; presente, «Modificado».
 */
export function wordChartPresetsDecisiones(
  actual: Record<string, Record<string, unknown>>,
  referencia: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const chart = wordPresetsDecisiones(actual, referencia).chart_presets;
  if (!isObj(chart)) return {};
  const out: Record<string, Record<string, unknown>> = {};
  for (const [tipo, args] of Object.entries(chart)) if (isObj(args)) out[tipo] = args;
  return out;
}
