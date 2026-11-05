// La propuesta del motor para el resumen ejecutivo («Hallazgos clave» en modo resumen o titulares) y el resumen de
// diferencias (H13 del checklist de usabilidad del editor, 2026-11-05). Sólo lectura:
//   POST /api/graficos/resumenes/propuesta  {slide, config?, scope?}  la lámina y el plan SIN guardar
//   GET  /api/graficos/resumenes/propuesta?slide_id=<id>              la lámina y el plan guardados
// (api/R/router_graficos_propuesta.R). Cada capítulo viene en la forma que guarda el editor más campos de sólo lectura
// (`pregunta`, `cifra`, `n`, `diferencia`, `diferencia_estado` y `frase` o `rotulo_lamina`) que NO se guardan en el plan.
// R serializa con auto_unbox: un vector de uno puede llegar en caja o suelto, y una lista vacía como `{}`.

import { apiFetch, handle, headers } from "./core";
import type { Slide } from "./graficos";

export type TipoPropuesta = "p_slide_hallazgos" | "p_slide_resumen_diferencias";
export type EstadoDiferencia = "diferencia" | "sin_diferencias" | "sin_prueba";

/** Lo que se ve de cada elemento propuesto y no se guarda. */
export type LecturaPropuesta = {
  pregunta: string;
  cifra: string;
  /** Base de la cifra; `null` si el motor no la mandó. */
  n: number | null;
  diferencia: string;
  diferenciaEstado: EstadoDiferencia;
  /** Viene de una pregunta clave del estudio (`plan.preguntas_clave`, H14). Sin el campo, `false`. */
  clave: boolean;
};

export type CifraPropuesta = LecturaPropuesta & {
  var: string;
  fila: string;
  top2box: string[];
  /** Lo que escribió el estudio para la cifra; vacío si la lámina usa la frase de respaldo. */
  texto: string;
  comparacion: string;
  /** La frase que sale en la lámina (el texto o, sin él, «respondió «…»»). */
  frase: string;
};

export type FilaPropuesta = LecturaPropuesta & {
  var: string;
  fila: string;
  top2box: string[];
  rotulo: string;
  /** El rótulo con que la fila sale en la lámina (puede llevar la base). */
  rotuloLamina: string;
};

export type CapituloPropuestaHallazgos = { titulo: string; cifras: CifraPropuesta[] };
export type CapituloPropuestaResumen = { titulo: string; filas: FilaPropuesta[] };

type Comun = { slideId: string; base: string; avisos: string[] };

export type PropuestaResumen =
  | (Comun & { tipo: "p_slide_hallazgos"; modo: string; capitulos: CapituloPropuestaHallazgos[] })
  | (Comun & { tipo: "p_slide_resumen_diferencias"; capitulos: CapituloPropuestaResumen[] });

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uno = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);
const texto = (v: unknown): string => {
  const x = uno(v);
  return typeof x === "string" ? x : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
};
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null || (esObjeto(v) && !Object.keys(v).length) ? [] : [v]);
const textos = (v: unknown): string[] => lista(v).map(texto).map((t) => t.trim()).filter(Boolean);
const numero = (v: unknown): number | null => {
  const x = uno(v);
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
/** `TRUE` de R llega como `true` (o en caja); cualquier otra cosa es `false`. */
const esVerdad = (v: unknown): boolean => { const x = uno(v); return x === true || x === 1 || x === "true" || x === "TRUE"; };
const ESTADOS: ReadonlySet<string> = new Set(["diferencia", "sin_diferencias", "sin_prueba"]);
const estado = (v: unknown): EstadoDiferencia => {
  const t = texto(v);
  return ESTADOS.has(t) ? (t as EstadoDiferencia) : "sin_prueba";
};

function lectura(o: Record<string, unknown>): LecturaPropuesta {
  return {
    pregunta: texto(o.pregunta).trim(),
    cifra: texto(o.cifra).trim(),
    n: numero(o.n),
    diferencia: texto(o.diferencia).trim(),
    diferenciaEstado: estado(o.diferencia_estado),
    clave: esVerdad(o.clave),
  };
}

/** Un elemento sin pregunta o sin respuesta que contar no se puede llevar al editor: se descarta. */
const cuenta = (o: Record<string, unknown>): boolean => !!texto(o.var).trim() && (!!texto(o.fila).trim() || textos(o.top2box).length > 0);

function cifra(o: Record<string, unknown>): CifraPropuesta {
  const lee = lectura(o);
  const propio = texto(o.texto).trim();
  return {
    ...lee,
    var: texto(o.var).trim(),
    fila: texto(o.fila).trim(),
    top2box: textos(o.top2box),
    texto: propio,
    comparacion: texto(o.comparacion).trim() || "auto",
    frase: texto(o.frase).trim() || propio,
  };
}

function fila(o: Record<string, unknown>): FilaPropuesta {
  const rotulo = texto(o.rotulo).trim();
  return {
    ...lectura(o),
    var: texto(o.var).trim(),
    fila: texto(o.fila).trim(),
    top2box: textos(o.top2box),
    rotulo,
    rotuloLamina: texto(o.rotulo_lamina).trim() || rotulo,
  };
}

/** Normalizador defensivo: lo que no tiene forma de capítulo o de elemento queda fuera, nunca rompe el editor. */
export function normalizarPropuestaResumen(raw: unknown): PropuestaResumen {
  const r = esObjeto(raw) ? raw : {};
  const comun: Comun = { slideId: texto(r.slide_id), base: texto(r.base), avisos: textos(r.avisos) };
  const caps = lista(r.capitulos).filter(esObjeto);
  if (texto(r.tipo) === "p_slide_resumen_diferencias") {
    const capitulos = caps.flatMap((c) => {
      const filas = lista(c.filas).filter(esObjeto).filter(cuenta).map(fila);
      return filas.length ? [{ titulo: texto(c.titulo).trim(), filas }] : [];
    });
    return { ...comun, tipo: "p_slide_resumen_diferencias", capitulos };
  }
  const capitulos = caps.flatMap((c) => {
    const cifras = lista(c.cifras).filter(esObjeto).filter(cuenta).map(cifra);
    return cifras.length ? [{ titulo: texto(c.titulo).trim(), cifras }] : [];
  });
  return { ...comun, tipo: "p_slide_hallazgos", modo: texto(r.modo) || "resumen", capitulos };
}

export type PedidoPropuesta = {
  slide: Slide;
  /** El plan sin guardar, como lo arma la vista previa. */
  config?: unknown;
  scope?: "active" | "consolidated";
  signal?: AbortSignal;
};

/** Tarda de 6 a 13 s en un estudio real: síncrono, se pide a demanda y nunca por tecla. */
export async function apiGraficosPropuestaResumen({ slide, config, scope, signal }: PedidoPropuesta): Promise<PropuestaResumen> {
  const cuerpo = { slide, ...(config !== undefined ? { config } : {}), ...(scope === "consolidated" ? { scope } : {}) };
  return normalizarPropuestaResumen(await handle<unknown>(await apiFetch("/api/graficos/resumenes/propuesta", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(cuerpo),
    signal,
  })));
}
