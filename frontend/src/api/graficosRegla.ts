// graficosRegla.ts — la regla con que una lámina de resumen elige sus preguntas y su conteo en vivo (ADR 0135 §2 y §4).
//
// Contrato: `api/R/router_graficos_regla.R` y `.regla_preguntas_conteo()` (graficos_regla_preguntas.R).
//   POST /api/graficos/resumenes/regla  {graficador, args, scope?}
//     -> {ok, total, seleccionadas, candidatas: [{tema, etiqueta, metrica, seleccionada}], texto_regla, avisos}
// Una regla inválida responde 400 con `E_REGLA_PREGUNTAS_INVALIDA`. El normalizador es defensivo (patrón de
// `normalizeGraficosShareInspect`): un campo que falta o que esta versión no conoce cae a un valor seguro.

import { apiFetch, handle, headers } from "./core";

export const TIPOS_REGLA_PREGUNTAS = [
  "todas", "comunes", "mayor_diferencia", "diferencia_minima", "mayor_sin_info", "bajo_umbral", "extremos", "a_mano",
] as const;

export type TipoReglaPreguntas = (typeof TIPOS_REGLA_PREGUNTAS)[number];

/** El arg `regla` de `p_panorama`, `p_dumbbell` y `p_barras_divergentes` (estilo resumen). */
export type ReglaPreguntas = {
  tipo: TipoReglaPreguntas;
  n?: number;
  umbral?: number;
  agregar?: string[];
  quitar?: string[];
};

export type CandidataRegla = {
  tema: string;
  etiqueta: string;
  /** La cifra con que la regla ordena (diferencia, Sin información, mínimo o promedio); `null` sin dato. */
  metrica: number | null;
  seleccionada: boolean;
};

export type ConteoRegla = {
  total: number;
  seleccionadas: string[];
  candidatas: CandidataRegla[];
  /** El texto que va en la nota de la lámina, tal como lo redacta el motor. */
  texto_regla: string;
  avisos: string[];
};

export type PedidoConteoRegla = {
  graficador: string;
  args: Readonly<Record<string, unknown>>;
  scope?: "consolidated";
};

export const CODIGO_REGLA_INVALIDA = "E_REGLA_PREGUNTAS_INVALIDA";

export function esTipoRegla(v: unknown): v is TipoReglaPreguntas {
  return typeof v === "string" && (TIPOS_REGLA_PREGUNTAS as readonly string[]).includes(v);
}

const comoObjeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const comoTexto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

const comoLista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]);

const comoTextos = (v: unknown): string[] => comoLista(v).map(comoTexto).filter((t) => t !== "");

const comoNumero = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function normalizarConteoRegla(raw: unknown): ConteoRegla {
  const r = comoObjeto(raw);
  const total = comoNumero(r.total);
  const candidatas = comoLista(r.candidatas).flatMap((c): CandidataRegla[] => {
    const o = comoObjeto(c);
    const tema = comoTexto(o.tema);
    if (!tema) return [];
    return [{ tema, etiqueta: comoTexto(o.etiqueta) || tema, metrica: comoNumero(o.metrica), seleccionada: o.seleccionada === true }];
  });
  return {
    total: total !== null && total >= 0 ? Math.round(total) : candidatas.length,
    seleccionadas: comoTextos(r.seleccionadas),
    candidatas,
    texto_regla: comoTexto(r.texto_regla),
    avisos: comoTextos(r.avisos),
  };
}

export async function apiGraficosConteoRegla(pedido: PedidoConteoRegla, request?: { signal?: AbortSignal }): Promise<ConteoRegla> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/resumenes/regla", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ graficador: pedido.graficador, args: pedido.args, ...(pedido.scope ? { scope: pedido.scope } : {}) }),
      signal: request?.signal,
    }),
  );
  return normalizarConteoRegla(raw);
}
