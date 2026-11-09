// Rótulos cortos del mazo de Gráficos (ADR 0141). `plan.rotulos_cortos` guarda dos mapas en uno:
//   { "<rótulo completo de una opción>": "<corto>", "preguntas": { "<base>$<variable>": "<corto>" } }
// `preguntas` es una clave reservada: el mapa de opciones la salta. Vale sólo para Gráficos; Analítica no lo lee.
//
//   GET  /api/graficos/rotulos/ranking?scope=graficos  -> por base, preguntas y opciones del rótulo más largo al más corto
//   POST /api/graficos/rotulos {preguntas?, opciones?}  -> una sección presente reemplaza la guardada; `null` quita
//
// Tras el POST, quien llama lleva `rotulos_cortos` de la respuesta al store del plan: si no, el autosave lo pisa.

import { ApiError, apiFetch, handle, headers } from "./core";
import { isObj, normalizarRotulosCortos, texto, type RotulosCortosPlan } from "./graficosRotulosPlan";

export {
  CLAVE_PREGUNTAS,
  normalizarRotulosCortos,
  opcionesDeRotulos,
  preguntasDeRotulos,
  unirRotulos,
  type MapaRotulos,
  type RotulosCortosPlan,
} from "./graficosRotulosPlan";

export type RankingPregunta = {
  ref: string;
  etiqueta: string;
  largo: number;
  usos: number;
  corto?: string;
  /** El nombre corto escrito en algún gráfico del plan. Sólo se informa. */
  corto_en_grafico?: string;
};

export type RankingOpcion = {
  /** `base$list_name` */
  ref: string;
  codigo: string;
  etiqueta: string;
  largo: number;
  usos: number;
  corto?: string;
};

export type RankingBase = { base: string; preguntas: RankingPregunta[]; opciones: RankingOpcion[] };

export type RankingRotulos = { bases: RankingBase[] };

export type AvisoRotulos = { tipo: "preguntas" | "opciones"; base: string; corto: string; refs: string[] };

export type GuardadoRotulos = { rotulos_cortos: RotulosCortosPlan; avisos: AvisoRotulos[]; saved_at: string };

export type PedidoRotulos = {
  preguntas?: Record<string, string | null>;
  opciones?: Record<string, string | null>;
};

function entero(x: unknown, porDefecto: number): number {
  const v = Array.isArray(x) && x.length === 1 ? x[0] : x;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : porDefecto;
}

const lista = (x: unknown): unknown[] => (Array.isArray(x) ? x : isObj(x) ? Object.values(x) : []);

function normalizarPregunta(x: unknown): RankingPregunta | null {
  if (!isObj(x)) return null;
  const ref = texto(x.ref);
  const etiqueta = texto(x.etiqueta);
  if (!ref || !etiqueta) return null;
  const fila: RankingPregunta = { ref, etiqueta, largo: entero(x.largo, etiqueta.length), usos: entero(x.usos, 0) };
  const corto = texto(x.corto);
  if (corto) fila.corto = corto;
  const deGrafico = texto(x.corto_en_grafico);
  if (deGrafico) fila.corto_en_grafico = deGrafico;
  return fila;
}

function normalizarOpcion(x: unknown): RankingOpcion | null {
  if (!isObj(x)) return null;
  const etiqueta = texto(x.etiqueta);
  if (!etiqueta) return null;
  const fila: RankingOpcion = {
    ref: texto(x.ref), codigo: texto(x.codigo), etiqueta, largo: entero(x.largo, etiqueta.length), usos: entero(x.usos, 0),
  };
  const corto = texto(x.corto);
  if (corto) fila.corto = corto;
  return fila;
}

const delMasLargo = <T extends { largo: number; etiqueta: string }>(a: T, b: T) => b.largo - a.largo;

/** Ranking defensivo: descarta filas sin rótulo y reordena del más largo al más corto (orden estable). */
export function normalizarRankingRotulos(raw: unknown): RankingRotulos {
  const bases = isObj(raw) ? lista(raw.bases) : [];
  return {
    bases: bases.filter(isObj).map((b) => ({
      base: texto(b.base) || "default",
      preguntas: lista(b.preguntas).map(normalizarPregunta).filter((f): f is RankingPregunta => !!f).sort(delMasLargo),
      opciones: lista(b.opciones).map(normalizarOpcion).filter((f): f is RankingOpcion => !!f).sort(delMasLargo),
    })),
  };
}

function normalizarAviso(x: unknown): AvisoRotulos | null {
  if (!isObj(x)) return null;
  const tipo = texto(x.tipo);
  const corto = texto(x.corto);
  if ((tipo !== "preguntas" && tipo !== "opciones") || !corto) return null;
  const refs = (Array.isArray(x.refs) ? x.refs : [x.refs]).map(texto).filter(Boolean);
  return { tipo, base: texto(x.base), corto, refs };
}

export function normalizarGuardadoRotulos(raw: unknown): GuardadoRotulos {
  const r = isObj(raw) ? raw : {};
  return {
    rotulos_cortos: normalizarRotulosCortos(r.rotulos_cortos),
    avisos: lista(r.avisos).map(normalizarAviso).filter((a): a is AvisoRotulos => !!a),
    saved_at: texto(r.saved_at),
  };
}

/** Un 400 del guardado, con la entrada que lo causó (`details.clave` o `details.ref`) y el mensaje legible. */
export class ErrorRotuloCorto extends ApiError {
  readonly clave: string | null;
  readonly mensaje: string;
  constructor(code: string, mensaje: string, clave: string | null) {
    super(code, mensaje);
    this.name = "ErrorRotuloCorto";
    this.clave = clave;
    this.mensaje = mensaje;
  }
}

/** Lee `error.details` de una respuesta de error ya fallida. */
export function errorDeGuardado(code: string, cuerpo: unknown, porDefecto: string): ErrorRotuloCorto {
  const error = isObj(cuerpo) && isObj(cuerpo.error) ? cuerpo.error : {};
  const detalles = isObj(error.details) ? error.details : {};
  const clave = texto(detalles.clave) || texto(detalles.ref) || null;
  return new ErrorRotuloCorto(code, texto(error.message) || porDefecto, clave);
}

export async function apiGraficosRotulosRanking(): Promise<RankingRotulos> {
  const raw = await handle<unknown>(await apiFetch("/api/graficos/rotulos/ranking?scope=graficos", { headers: headers() }));
  return normalizarRankingRotulos(raw);
}

export async function apiGraficosRotulosGuardar(pedido: PedidoRotulos): Promise<GuardadoRotulos> {
  const res = await apiFetch("/api/graficos/rotulos", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(pedido),
  });
  if (!res.ok) {
    const copia = res.clone();
    try {
      await handle<unknown>(res);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      const cuerpo: unknown = await copia.json().catch(() => null);
      throw errorDeGuardado(e.code, cuerpo, e.message);
    }
  }
  return normalizarGuardadoRotulos(await res.json());
}
