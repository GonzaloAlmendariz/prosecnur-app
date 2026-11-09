// graficosCoberturaCategorias.ts — las categorías de una variable por base, para prellenar el universo de la cobertura
// por categorías (ADR 0140).
//
// Contrato: `api/R/router_graficos_cobertura_categorias.R` y `.cobcat_categorias_por_base()` (graficos_cobertura_categorias.R).
//   POST /api/graficos/resumenes/cobertura-categorias  {variable, bases?: [base], filtros?, scope?}
//     -> {ok, variable, bases: [{base, variable_usada, recodificada, n_encuestados, n_validos,
//                                categorias: [{codigo, etiqueta, n}], especiales: [{codigo, etiqueta, n}]}]}
// `bases` vacío toma todas las del estudio. Las categorías del instrumento llegan aunque nadie las haya marcado (n = 0).
// Errores 400: E_COBERTURA_CAT_VARIABLE, E_COBERTURA_CAT_BASE, E_COBERTURA_CAT_FILTROS. El normalizador es defensivo
// (patrón de `normalizeGraficosShareInspect`): lo que falta cae a «sin dato», nunca a un número inventado.

import { apiFetch, handle, headers } from "./core";

export type CategoriaMuestra = { codigo: string; etiqueta: string; n: number };

export type CategoriasDeBase = {
  base: string;
  /** La columna que se contó: la `_recod` si existe. La UI la guarda en el universo como `variable`. */
  variable_usada: string;
  recodificada: boolean;
  n_encuestados: number | null;
  n_validos: number | null;
  categorias: CategoriaMuestra[];
  especiales: CategoriaMuestra[];
};

export type CategoriasCobertura = { variable: string; bases: CategoriasDeBase[] };

export type PedidoCategoriasCobertura = {
  variable: string;
  /** Vacío: todas las bases del estudio. */
  bases?: readonly string[];
  /** Los filtros de la lámina, tal como los guarda el plan (el motor los aplica igual que al dibujar). */
  filtros?: unknown;
  scope?: "active" | "consolidated";
};

export const CODIGOS_ERROR_COBERTURA_CAT = ["E_COBERTURA_CAT_VARIABLE", "E_COBERTURA_CAT_BASE", "E_COBERTURA_CAT_FILTROS"] as const;

const comoObjeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

// jsonlite desempaca vectores de uno a escalares, pero un `auto_unbox` ausente los deja como `[x]`.
const escalar = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);

const comoTexto = (v: unknown): string => {
  const x = escalar(v);
  return typeof x === "string" ? x.trim() : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};

const comoConteo = (v: unknown): number | null => {
  const x = escalar(v);
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

function categorias(v: unknown): CategoriaMuestra[] {
  const vistas = new Set<string>();
  return (Array.isArray(v) ? v : []).flatMap((c): CategoriaMuestra[] => {
    const o = comoObjeto(c);
    const codigo = comoTexto(o.codigo);
    if (!codigo || vistas.has(codigo)) return [];
    vistas.add(codigo);
    return [{ codigo, etiqueta: comoTexto(o.etiqueta) || codigo, n: comoConteo(o.n) ?? 0 }];
  });
}

export function normalizarCategoriasCobertura(raw: unknown): CategoriasCobertura {
  const r = comoObjeto(raw);
  const vistas = new Set<string>();
  const bases = (Array.isArray(r.bases) ? r.bases : []).flatMap((b): CategoriasDeBase[] => {
    const o = comoObjeto(b);
    const base = comoTexto(o.base);
    if (!base || vistas.has(base)) return [];
    vistas.add(base);
    return [{
      base,
      variable_usada: comoTexto(o.variable_usada),
      recodificada: escalar(o.recodificada) === true,
      n_encuestados: comoConteo(o.n_encuestados),
      n_validos: comoConteo(o.n_validos),
      categorias: categorias(o.categorias),
      especiales: categorias(o.especiales),
    }];
  });
  return { variable: comoTexto(r.variable), bases };
}

const conFiltros = (f: unknown): boolean =>
  Array.isArray(f) ? f.length > 0 : !!f && typeof f === "object" && Object.keys(f).length > 0;

export async function apiGraficosCategoriasCobertura(
  pedido: PedidoCategoriasCobertura, request?: { signal?: AbortSignal },
): Promise<CategoriasCobertura> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/resumenes/cobertura-categorias", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        variable: pedido.variable,
        ...(pedido.bases && pedido.bases.length ? { bases: [...pedido.bases] } : {}),
        ...(conFiltros(pedido.filtros) ? { filtros: pedido.filtros } : {}),
        ...(pedido.scope === "consolidated" ? { scope: pedido.scope } : {}),
      }),
      signal: request?.signal,
    }),
  );
  return normalizarCategoriasCobertura(raw);
}
