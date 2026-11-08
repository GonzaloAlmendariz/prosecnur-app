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

// ---- Detalle de cifras (el antes y el después del inspector) ------------------------------------------------------
//
// Contrato: `api/R/router_graficos_regla.R` y `api/R/graficos_cifras_detalle.R`. Con `detalle: true` la misma ruta
// acepta también los categóricos, apilados y divergentes (p_barras_categoricas, p_barras_agrupadas de una serie,
// p_barras_apiladas, p_barras_multiapiladas, p_barras_divergentes) y cada respuesta trae `detalle`, leído de la
// especificación que dibuja la lámina: sus pesos, filtros, universo y exclusiones. Nunca se aproxima con
// `/api/graficos/categorias`.
//   POST /api/graficos/resumenes/cifras  {graficador, args, detalle: true, caja?: [rotulo], scope?}
//   POST /api/graficos/resumenes/cifras  {laminas: [{id, slide: {graficador, args}, caja?}], detalle: true, scope?}
//     detalle: {forma, version, base: {n_ponderado, n_casos, texto}, redondeo: {metodo, decimales},
//               categorias: [{clave, rotulo, especial, lado}],
//               filas: [{clave, rotulo, es_total, base: {n_ponderado, n_casos}, valores: [{categoria, texto, valor, proporcion}],
//                        sumas: {lamina, estandar, reparto: {valor, texto, aplica}} | null,
//                        caja: {rotulo, categorias, valor, texto, origen} | null,
//                        lados: {negativo, neutro, positivo, sin_informacion} | null}]} | null
// El antes y el después se piden como dos láminas del mismo lote con distintos args; las categorías y las filas se
// emparejan por `clave` (el rótulo de la lámina). `detalle` null: la lámina no lo publica con esa configuración.

export type FormaDetalle = "categorica" | "escala" | "divergentes";
export type LadoDetalle = "neg" | "neu" | "pos" | "sin_inf";

/** Una cifra como la escribe la lámina: `valor` en por ciento (el rotulado) y su `texto`. */
export type CifraDetalle = { valor: number | null; texto: string };

export type BaseDetalle = { nPonderado: number | null; nCasos: number | null };

export type CategoriaDetalle = { clave: string; rotulo: string; especial: boolean; lado: LadoDetalle | null };

export type ValorDetalle = {
  /** La `clave` de la categoría (su rótulo en la lámina). */
  categoria: string;
  /** Tal cual se rotula («43% (12)», «21.6% a»). */
  texto: string;
  /** La cifra rotulada, en por ciento, con el redondeo y los decimales de la lámina. */
  valor: number | null;
  /** La proporción exacta (0 a 1) que se redondeó. */
  proporcion: number | null;
};

export type SumasDetalle = {
  lamina: CifraDetalle;
  estandar: CifraDetalle;
  /** `aplica` es false en una categórica que no cierra a 100 (respuesta múltiple): ahí el reparto no significa nada. */
  reparto: CifraDetalle & { aplica: boolean };
};

export type CajaDetalle = CifraDetalle & { rotulo: string; categorias: string[]; origen: "lamina" | "pedido" };

export type LadosDetalle = { negativo: CifraDetalle; neutro: CifraDetalle; positivo: CifraDetalle; sinInformacion: CifraDetalle };

export type FilaDetalle = {
  clave: string;
  rotulo: string;
  esTotal: boolean;
  base: BaseDetalle;
  valores: ValorDetalle[];
  sumas: SumasDetalle | null;
  caja: CajaDetalle | null;
  lados: LadosDetalle | null;
};

export type DetalleCifras = {
  forma: FormaDetalle;
  version: string;
  /** La base común de las filas (sus `n` en null si difieren) y la «Base: N» de la lámina. */
  base: BaseDetalle & { texto: string };
  redondeo: { metodo: "estandar" | "reparto"; decimales: number };
  categorias: CategoriaDetalle[];
  filas: FilaDetalle[];
};

export type CifrasConDetalle = CifrasDeGrafico & { detalle: DetalleCifras | null };

const FORMAS: readonly FormaDetalle[] = ["categorica", "escala", "divergentes"];
const LADOS: readonly LadoDetalle[] = ["neg", "neu", "pos", "sin_inf"];

const comoBooleano = (v: unknown): boolean => escalar(v) === true;

const esObjeto = (v: unknown): boolean => Boolean(v) && typeof v === "object" && !Array.isArray(v);

const comoCifra = (v: unknown): CifraDetalle => {
  const o = comoObjeto(v);
  return { valor: comoNumero(o.valor), texto: comoTexto(o.texto) };
};

const comoBase = (v: unknown): BaseDetalle => {
  const o = comoObjeto(v);
  return { nPonderado: comoNumero(o.n_ponderado), nCasos: comoNumero(o.n_casos) };
};

function comoSumas(v: unknown): SumasDetalle | null {
  if (!esObjeto(v)) return null;
  const o = comoObjeto(v);
  return { lamina: comoCifra(o.lamina), estandar: comoCifra(o.estandar), reparto: { ...comoCifra(o.reparto), aplica: comoBooleano(comoObjeto(o.reparto).aplica) } };
}

function comoCaja(v: unknown): CajaDetalle | null {
  if (!esObjeto(v)) return null;
  const o = comoObjeto(v);
  const origen = comoTexto(o.origen) === "pedido" ? "pedido" : "lamina";
  return { ...comoCifra(o), rotulo: comoTexto(o.rotulo), categorias: comoLista(o.categorias).map(comoTexto).filter(Boolean), origen };
}

function comoLados(v: unknown): LadosDetalle | null {
  if (!esObjeto(v)) return null;
  const o = comoObjeto(v);
  return { negativo: comoCifra(o.negativo), neutro: comoCifra(o.neutro), positivo: comoCifra(o.positivo), sinInformacion: comoCifra(o.sin_informacion) };
}

function comoFila(v: unknown): FilaDetalle | null {
  const o = comoObjeto(v);
  const clave = comoTexto(o.clave);
  if (!clave) return null;
  const valores = comoLista(o.valores).flatMap((x): ValorDetalle[] => {
    const e = comoObjeto(x);
    const categoria = comoTexto(e.categoria);
    return categoria ? [{ categoria, texto: comoTexto(e.texto), valor: comoNumero(e.valor), proporcion: comoNumero(e.proporcion) }] : [];
  });
  return {
    clave, rotulo: comoTexto(o.rotulo) || clave, esTotal: comoBooleano(o.es_total), base: comoBase(o.base), valores,
    sumas: comoSumas(o.sumas), caja: comoCaja(o.caja), lados: comoLados(o.lados),
  };
}

/** El `detalle` del motor, o null si falta, viene en null o su forma no es una de las tres. */
export function normalizarDetalleCifras(raw: unknown): DetalleCifras | null {
  if (!esObjeto(raw)) return null;
  const r = comoObjeto(raw);
  const forma = comoTexto(r.forma) as FormaDetalle;
  if (!FORMAS.includes(forma)) return null;
  const red = comoObjeto(r.redondeo);
  const decimales = comoNumero(red.decimales);
  const categorias = comoLista(r.categorias).flatMap((x): CategoriaDetalle[] => {
    const c = comoObjeto(x);
    const clave = comoTexto(c.clave);
    if (!clave) return [];
    const lado = comoTexto(c.lado) as LadoDetalle;
    return [{ clave, rotulo: comoTexto(c.rotulo) || clave, especial: comoBooleano(c.especial), lado: LADOS.includes(lado) ? lado : null }];
  });
  return {
    forma,
    version: comoTexto(r.version),
    base: { ...comoBase(r.base), texto: comoTexto(comoObjeto(r.base).texto) },
    redondeo: { metodo: comoTexto(red.metodo) === "reparto" ? "reparto" : "estandar", decimales: decimales !== null && decimales >= 0 ? decimales : 0 },
    categorias,
    filas: comoLista(r.filas).map(comoFila).filter((f): f is FilaDetalle => f !== null),
  };
}

export function normalizarCifrasConDetalle(raw: unknown): CifrasConDetalle {
  return { ...normalizarCifras(raw), detalle: normalizarDetalleCifras(comoObjeto(raw).detalle) };
}

export type PedidoCifrasDetalle = PedidoCifras & { caja?: readonly string[] };

export async function apiGraficosCifrasDetalle(pedido: PedidoCifrasDetalle, request?: { signal?: AbortSignal }): Promise<CifrasConDetalle> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/resumenes/cifras", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        graficador: pedido.graficador, args: pedido.args, detalle: true,
        ...(pedido.caja && pedido.caja.length ? { caja: pedido.caja } : {}),
        ...(pedido.scope ? { scope: pedido.scope } : {}),
      }),
      signal: request?.signal,
    }),
  );
  return normalizarCifrasConDetalle(raw);
}

export type LaminaCifrasDetalle = LaminaCifras & { caja?: readonly string[] };

export type PedidoCifrasDetalleLote = { laminas: readonly LaminaCifrasDetalle[]; scope?: "consolidated" };

export type EntradaLoteDetalle = EntradaLoteCifras & { detalle: DetalleCifras | null };

export function normalizarCifrasDetalleLote(raw: unknown): Record<string, EntradaLoteDetalle> {
  const base = normalizarCifrasLote(raw);
  const por = comoObjeto(comoObjeto(raw).por_lamina);
  const out: Record<string, EntradaLoteDetalle> = {};
  for (const [id, entrada] of Object.entries(base)) out[id] = { ...entrada, detalle: normalizarDetalleCifras(comoObjeto(por[id]).detalle) };
  return out;
}

export async function apiGraficosCifrasDetalleLote(
  pedido: PedidoCifrasDetalleLote,
  request?: { signal?: AbortSignal },
): Promise<Record<string, EntradaLoteDetalle>> {
  const raw = await handle<unknown>(
    await apiFetch("/api/graficos/resumenes/cifras", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        detalle: true,
        laminas: pedido.laminas.map((l) => ({
          id: l.id, slide: { graficador: l.graficador, args: l.args }, ...(l.caja && l.caja.length ? { caja: l.caja } : {}),
        })),
        ...(pedido.scope ? { scope: pedido.scope } : {}),
      }),
      signal: request?.signal,
    }),
  );
  return normalizarCifrasDetalleLote(raw);
}
