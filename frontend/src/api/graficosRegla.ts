// graficosRegla.ts — la regla con que una lámina de resumen elige sus preguntas y su conteo en vivo (ADR 0135 §2 y §4).
//
// Contrato: `api/R/router_graficos_regla.R` y `.regla_preguntas_conteo()` (graficos_regla_preguntas.R).
//   POST /api/graficos/resumenes/regla  {graficador, args, scope?, config?}   config: la del editor (R5-12)
//     -> {ok, total, seleccionadas, candidatas: [{tema, etiqueta, metrica, seleccionada}], texto_regla, avisos, tope_filas,
//         cabe_nativa, motivo_imagen}
// `tope_filas` es el tope de filas de la lámina nativa (20 en la escala del resumen) o `null` si el graficador no tiene.
// `cabe_nativa` dice si la lámina nativa dibuja lo elegido: en la escala del resumen es `false` con más filas que el tope
// o con más de una columna «Sin información» (98 y 99), y `motivo_imagen` trae la causa; `null` en los demás gráficos.
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
  /** Filas que admite la lámina nativa para este graficador y estilo; `null` si no tiene tope. `normalizarConteoRegla`
   *  lo llena siempre; es opcional en el tipo sólo para que los conteos armados a mano (fixtures) sigan valiendo. */
  tope_filas?: number | null;
  /** ¿La lámina nativa dibuja lo elegido? `false`: sale como imagen (ver `motivo_imagen`); `null`: el gráfico no tiene
   *  esa restricción o el motor no lo dijo. Nunca se deduce de `tope_filas`: hay otra causa (dos «Sin información»). */
  cabe_nativa?: boolean | null;
  /** Por qué sale como imagen, en la redacción del motor; `null` si cabe o no aplica. */
  motivo_imagen?: string | null;
};

export type PedidoConteoRegla = {
  graficador: string;
  args: Readonly<Record<string, unknown>>;
  scope?: "consolidated";
  /** La config del editor (presets, paletas, overrides), como la vista previa: el motor cuenta con sus presets (R5-12). */
  config?: unknown;
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

// Un tope es un entero positivo; cualquier otra cosa (ausente, 0, negativo, texto) es «sin tope», nunca un número inventado.
const comoTope = (v: unknown): number | null => {
  const n = comoNumero(Array.isArray(v) && v.length === 1 ? v[0] : v);
  return n !== null && n >= 1 ? Math.floor(n) : null;
};

// Un booleano sólo si el motor lo escribió como tal (o como arreglo de uno, por el `auto_unbox`); lo demás es «no dicho».
const comoBooleano = (v: unknown): boolean | null => {
  const b = Array.isArray(v) && v.length === 1 ? v[0] : v;
  return typeof b === "boolean" ? b : null;
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
    tope_filas: comoTope(r.tope_filas),
    cabe_nativa: comoBooleano(r.cabe_nativa),
    motivo_imagen: comoTexto(Array.isArray(r.motivo_imagen) && r.motivo_imagen.length === 1 ? r.motivo_imagen[0] : r.motivo_imagen) || null,
  };
}

export async function apiGraficosConteoRegla(pedido: PedidoConteoRegla, request?: { signal?: AbortSignal }): Promise<ConteoRegla> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/resumenes/regla", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        graficador: pedido.graficador, args: pedido.args,
        ...(pedido.scope ? { scope: pedido.scope } : {}),
        ...(pedido.config !== undefined ? { config: pedido.config } : {}),
      }),
      signal: request?.signal,
    }),
  );
  return normalizarConteoRegla(raw);
}
