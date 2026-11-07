// graficosEmparejado.ts: la revisión del emparejado entre públicos del contraste (ADR 0135 §7, enmienda al ADR 0104 en
// Gráficos).
//
// Contrato: `api/R/router_graficos_regla.R` y `.graficos_emparejado()` (graficos_emparejado_sugerido.R).
//   POST /api/graficos/resumenes/emparejado  {bases: [A, B], vars?, scope?}
//     -> {ok, bases, preguntas: [{tema, base, var, etiqueta, estado: "matriz"|"sin_par", par?, sugerencias}]}
// Sólo lectura: las sugerencias son por parecido de texto y no entran a la lámina ni a la matriz hasta que el analista
// las confirma fila por fila. El normalizador es defensivo (patrón de `normalizeGraficosShareInspect`): una fila sin
// base o sin variable se descarta, un estado desconocido cae a «sin_par» y un puntaje ilegible a 0.

import { apiFetch, handle, headers } from "./core";

export type PreguntaDeBase = { base: string; var: string; etiqueta: string };

export type SugerenciaEmparejado = PreguntaDeBase & {
  /** Parecido de texto en [0, 1]. */
  puntaje: number;
};

export type PreguntaEmparejado = PreguntaDeBase & {
  tema: string;
  estado: "matriz" | "sin_par";
  /** El par que declara la matriz (sólo con `estado = "matriz"`). */
  par: PreguntaDeBase | null;
  sugerencias: SugerenciaEmparejado[];
};

export type Emparejado = { bases: string[]; preguntas: PreguntaEmparejado[] };

export type PedidoEmparejado = {
  bases: readonly [string, string];
  vars?: readonly string[];
  scope?: "consolidated";
};

const comoObjeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

// jsonlite desempaca vectores de uno a escalares, pero un `auto_unbox` ausente los deja como `[x]`.
const escalar = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);

const comoTexto = (v: unknown): string => {
  const x = escalar(v);
  return typeof x === "string" ? x.trim() : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};

const comoLista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]);

const comoPuntaje = (v: unknown): number => {
  const x = escalar(v);
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
};

function preguntaDeBase(v: unknown): PreguntaDeBase | null {
  const o = comoObjeto(v);
  const base = comoTexto(o.base);
  const variable = comoTexto(o.var);
  if (!base || !variable) return null;
  return { base, var: variable, etiqueta: comoTexto(o.etiqueta) || variable };
}

export function normalizarEmparejado(raw: unknown): Emparejado {
  const r = comoObjeto(raw);
  const preguntas = comoLista(r.preguntas).flatMap((p): PreguntaEmparejado[] => {
    const base = preguntaDeBase(p);
    if (!base) return [];
    const o = comoObjeto(p);
    const par = preguntaDeBase(o.par);
    const estado = comoTexto(o.estado) === "matriz" && par ? "matriz" : "sin_par";
    const sugerencias = estado === "matriz" ? [] : comoLista(o.sugerencias).flatMap((s): SugerenciaEmparejado[] => {
      const q = preguntaDeBase(s);
      return q ? [{ ...q, puntaje: comoPuntaje(comoObjeto(s).puntaje) }] : [];
    });
    return [{ ...base, tema: comoTexto(o.tema) || base.etiqueta, estado, par: estado === "matriz" ? par : null, sugerencias }];
  });
  return { bases: comoLista(r.bases).map(comoTexto).filter(Boolean), preguntas };
}

export async function apiGraficosEmparejado(pedido: PedidoEmparejado, request?: { signal?: AbortSignal }): Promise<Emparejado> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/resumenes/emparejado", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        bases: [...pedido.bases],
        ...(pedido.vars?.length ? { vars: [...pedido.vars] } : {}),
        ...(pedido.scope ? { scope: pedido.scope } : {}),
      }),
      signal: request?.signal,
    }),
  );
  return normalizarEmparejado(raw);
}
