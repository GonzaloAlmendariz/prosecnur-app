// graficosInventario.ts — qué tiene el estudio para cada tipo de gráfico (selector por intención, ADR 0135).
//
// Contrato: `api/R/router_graficos_inventario.R` y `.graficos_inventario()` (graficos_inventario.R).
//   GET /api/graficos/resumenes/inventario?scope=
//     -> {ok, bases: [{base, publico, n, preguntas: {escala, opcion_unica, multiple, numerica, abierta},
//                      padron: {declarado, valor, origen, motivo}}]}
// El selector lo cruza con el `usa` de cada tipo (CATALOGO_GRAFICOS). Los tipos de pregunta no se solapan: «escala» es
// el criterio del ADR 0135 (batería o declarada ordinal, cuatro o más opciones sustantivas) y «opcion_unica», el resto de
// las `select_one`. El padrón es el DECLARADO en Cálculo de muestra o Monitoreo; la confirmación la escribe la tarjeta de
// cobertura en el payload. El normalizador es defensivo (patrón de `normalizeGraficosShareInspect`): un conteo que falta
// cae a 0 y un padrón que no llega, a «sin declarar», nunca a un número inventado.

import { apiFetch, handle, headers } from "./core";

export type PreguntasDelPublico = {
  escala: number;
  opcion_unica: number;
  multiple: number;
  numerica: number;
  abierta: number;
};

export type PadronDelPublico = {
  declarado: boolean;
  /** Padrón declarado; `null` si ninguna fuente lo declara. */
  valor: number | null;
  /** «Cálculo de muestra: marco validado (Docentes)»; vacío sin padrón. */
  origen: string;
  /** Por qué no hay padrón; vacío si lo hay. */
  motivo: string;
};

export type InventarioPublico = {
  base: string;
  publico: string;
  n: number;
  preguntas: PreguntasDelPublico;
  padron: PadronDelPublico;
};

const comoObjeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

// jsonlite desempaca vectores de uno a escalares, pero un `auto_unbox` ausente los deja como `[x]`.
const escalar = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);

const comoTexto = (v: unknown): string => {
  const x = escalar(v);
  return typeof x === "string" ? x : "";
};

const comoNumero = (v: unknown): number => {
  const x = escalar(v);
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : NaN;
};

const comoConteo = (v: unknown): number => {
  const n = comoNumero(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

const comoPositivo = (v: unknown): number | null => {
  const n = comoNumero(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function normalizarInventario(raw: unknown): InventarioPublico[] {
  const r = comoObjeto(raw);
  const filas = Array.isArray(r.bases) ? r.bases : [];
  const vistas = new Set<string>();
  return filas.flatMap((f): InventarioPublico[] => {
    const o = comoObjeto(f);
    const base = comoTexto(o.base).trim();
    if (!base || vistas.has(base)) return [];
    vistas.add(base);
    const p = comoObjeto(o.preguntas);
    const pad = comoObjeto(o.padron);
    const valor = comoPositivo(pad.valor);
    // Declarado sólo si llega con un valor: un `true` sin cifra no le dice nada al selector.
    const declarado = escalar(pad.declarado) === true && valor !== null;
    return [{
      base,
      publico: comoTexto(o.publico).trim() || base,
      n: comoConteo(o.n),
      preguntas: {
        escala: comoConteo(p.escala),
        opcion_unica: comoConteo(p.opcion_unica),
        multiple: comoConteo(p.multiple),
        numerica: comoConteo(p.numerica),
        abierta: comoConteo(p.abierta),
      },
      padron: {
        declarado,
        valor: declarado ? valor : null,
        origen: declarado ? comoTexto(pad.origen) : "",
        motivo: comoTexto(pad.motivo),
      },
    }];
  });
}

export async function apiGraficosInventario(
  scope: "active" | "consolidated" = "active",
  request?: { signal?: AbortSignal },
): Promise<InventarioPublico[]> {
  const query = scope === "consolidated" ? "?scope=consolidated" : "";
  const raw = await handle<unknown>(
    await apiFetch(`/api/graficos/resumenes/inventario${query}`, { headers: headers(), signal: request?.signal }),
  );
  return normalizarInventario(raw);
}
