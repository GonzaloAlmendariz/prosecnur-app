// graficosPadron.ts — la propuesta de padrón y meta por base para las láminas de resumen (ADR 0135 §6).
//
// Contrato: `api/R/router_graficos_regla.R` y `.graficos_padron_por_base()` (graficos_padron_por_base.R).
//   GET /api/graficos/resumenes/padron?scope=
//     -> {ok, bases: [{base, padron, padron_origen, meta, meta_unidad, meta_origen, motivo}]}
// Es una PROPUESTA: la tarjeta la muestra con su origen y el analista la confirma («Usar»); recién entonces se escribe
// en `universos`/`metas` del payload, porque el render no tiene sesión. Un NA llega como `null`. El normalizador es
// defensivo (patrón de `normalizeGraficosShareInspect`): un campo que falta cae a «sin dato», nunca a un número inventado.

import { apiFetch, handle, headers } from "./core";

export type UnidadMeta = "porcentaje" | "casos";

export type PadronPropuesto = {
  base: string;
  /** Padrón propuesto; `null` si ninguna fuente lo declara para esa base. */
  padron: number | null;
  /** «Cálculo de muestra: marco validado (Docentes)»; vacío sin padrón. */
  padron_origen: string;
  meta: number | null;
  meta_unidad: UnidadMeta | null;
  meta_origen: string;
  /** Por qué falta el padrón o la meta; vacío si están los dos. */
  motivo: string;
};

const comoObjeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

// jsonlite desempaca vectores de uno a escalares, pero un `auto_unbox` ausente los deja como `[x]`.
const escalar = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);

const comoTexto = (v: unknown): string => {
  const x = escalar(v);
  return typeof x === "string" ? x : "";
};

const comoPositivo = (v: unknown): number | null => {
  const x = escalar(v);
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function normalizarPadronPropuesto(raw: unknown): PadronPropuesto[] {
  const r = comoObjeto(raw);
  const filas = Array.isArray(r.bases) ? r.bases : [];
  const vistas = new Set<string>();
  return filas.flatMap((f): PadronPropuesto[] => {
    const o = comoObjeto(f);
    const base = comoTexto(o.base).trim();
    if (!base || vistas.has(base)) return [];
    vistas.add(base);
    const padron = comoPositivo(o.padron);
    const meta = comoPositivo(o.meta);
    const unidad = comoTexto(o.meta_unidad);
    const metaUnidad: UnidadMeta | null = unidad === "porcentaje" || unidad === "casos" ? unidad : null;
    return [{
      base,
      padron,
      padron_origen: padron !== null ? comoTexto(o.padron_origen) : "",
      // Una meta sin unidad no se puede escribir: «60» y «60%» dicen cosas distintas.
      meta: metaUnidad ? meta : null,
      meta_unidad: meta !== null ? metaUnidad : null,
      meta_origen: meta !== null && metaUnidad ? comoTexto(o.meta_origen) : "",
      motivo: comoTexto(o.motivo),
    }];
  });
}

export async function apiGraficosPadronPropuesto(
  scope: "active" | "consolidated" = "active",
  request?: { signal?: AbortSignal },
): Promise<PadronPropuesto[]> {
  const query = scope === "consolidated" ? "?scope=consolidated" : "";
  const raw = await handle<unknown>(
    await apiFetch(`/api/graficos/resumenes/padron${query}`, { headers: headers(), signal: request?.signal }),
  );
  return normalizarPadronPropuesto(raw);
}
