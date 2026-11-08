// graficosCifras.ts: las cifras con clave estable de un gráfico de resumen, para el cierre con hallazgos (ADR 0135 §6).
//
// Contrato: `api/R/router_graficos_regla.R` y `.graficos_cifras_de_grafico()` (graficos_cifras_clave.R).
//   POST /api/graficos/resumenes/cifras  {graficador, args, scope?}
//     -> {ok, tipo, cifras: [{clave, rotulo, texto, valor, unidad}], avisos}
// El `texto` es el de la lámina tal cual; el cierre guarda la `clave` y la lee de la lámina de origen al exportar. Un
// gráfico que no publica cifras responde 400 con `E_CIFRAS_INVALIDO`. El normalizador es defensivo (patrón de
// `normalizeGraficosShareInspect`): una cifra sin clave se descarta y un valor ilegible queda en `null`.
//
// Lote (el mismo endpoint, con `laminas` en vez de `graficador`; api/R/graficos_cifras_lote.R):
//   POST /api/graficos/resumenes/cifras  {laminas: [{id, slide: {graficador, args}}], scope?}
//     -> {ok, por_lamina: {<id>: {tipo, cifras, avisos, error?: {code, message}}}}
// El error de una lámina viaja en su entrada (200 para el lote); sólo un lote mal formado responde 400.

import { ApiError, apiFetch, handle, headers } from "./core";

export type CifraClave = {
  clave: string;
  rotulo: string;
  /** Como sale en la lámina («+12», «68%»). */
  texto: string;
  valor: number | null;
  /** La unidad que la lámina da por entendida («pts»), o "". */
  unidad: string;
};

export type CifrasDeGrafico = { tipo: string; cifras: CifraClave[]; avisos: string[] };

export type PedidoCifras = {
  graficador: string;
  args: Readonly<Record<string, unknown>>;
  scope?: "consolidated";
};

export const CODIGO_CIFRAS_INVALIDO = "E_CIFRAS_INVALIDO";

const comoObjeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

// jsonlite desempaca vectores de uno a escalares, pero un `auto_unbox` ausente los deja como `[x]`.
const escalar = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);

const comoTexto = (v: unknown): string => {
  const x = escalar(v);
  return typeof x === "string" ? x.trim() : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};

const comoLista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]);

const comoNumero = (v: unknown): number | null => {
  const x = escalar(v);
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function normalizarCifras(raw: unknown): CifrasDeGrafico {
  const r = comoObjeto(raw);
  const vistas = new Set<string>();
  const cifras = comoLista(r.cifras).flatMap((c): CifraClave[] => {
    const o = comoObjeto(c);
    const clave = comoTexto(o.clave);
    const texto = comoTexto(o.texto);
    if (!clave || !texto || vistas.has(clave)) return [];
    vistas.add(clave);
    return [{ clave, rotulo: comoTexto(o.rotulo) || clave, texto, valor: comoNumero(o.valor), unidad: comoTexto(o.unidad) }];
  });
  return { tipo: comoTexto(r.tipo), cifras, avisos: comoLista(r.avisos).map(comoTexto).filter(Boolean) };
}

export async function apiGraficosCifras(pedido: PedidoCifras, request?: { signal?: AbortSignal }): Promise<CifrasDeGrafico> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/resumenes/cifras", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ graficador: pedido.graficador, args: pedido.args, ...(pedido.scope ? { scope: pedido.scope } : {}) }),
      signal: request?.signal,
    }),
  );
  return normalizarCifras(raw);
}

export type LaminaCifras = { id: string; graficador: string; args: Readonly<Record<string, unknown>> };

export type PedidoCifrasLote = { laminas: readonly LaminaCifras[]; scope?: "consolidated" };

/** Una lámina del lote: sus cifras o el error del motor (`code` E_* y su frase). */
export type EntradaLoteCifras = { cifras: CifrasDeGrafico; error: { code: string; message: string } | null };

const MENSAJE_SIN_FRASE = "No se pudieron leer las cifras de esta lámina.";

export function normalizarCifrasLote(raw: unknown): Record<string, EntradaLoteCifras> {
  const por = comoObjeto(comoObjeto(raw).por_lamina);
  const out: Record<string, EntradaLoteCifras> = {};
  for (const [id, entrada] of Object.entries(por)) {
    if (!id) continue;
    const e = comoObjeto(entrada);
    const err = comoObjeto(e.error);
    const code = comoTexto(err.code);
    out[id] = { cifras: normalizarCifras(e), error: code ? { code, message: comoTexto(err.message) || MENSAJE_SIN_FRASE } : null };
  }
  return out;
}

/** El error de una entrada del lote como `ApiError`, para que los avisos lo traten igual que el del pedido suelto. */
export function errorDeEntrada(entrada: EntradaLoteCifras | undefined): ApiError | null {
  if (!entrada) return new ApiError("E_CIFRAS_INVALIDO", "La lámina no volvió en el lote de cifras.");
  return entrada.error ? new ApiError(entrada.error.code, entrada.error.message) : null;
}

export async function apiGraficosCifrasLote(
  pedido: PedidoCifrasLote,
  request?: { signal?: AbortSignal },
): Promise<Record<string, EntradaLoteCifras>> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/resumenes/cifras", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        laminas: pedido.laminas.map((l) => ({ id: l.id, slide: { graficador: l.graficador, args: l.args } })),
        ...(pedido.scope ? { scope: pedido.scope } : {}),
      }),
      signal: request?.signal,
    }),
  );
  return normalizarCifrasLote(raw);
}
