/**
 * La cadena de filtros de validez, paso a paso.
 *
 * Normaliza el bloque `cadena_filtros`. Lo que hace útil a este panel no es el
 * caso en que los filtros descartan mucho, sino el contrario: **un filtro
 * declarado que no descarta nada era invisible** cuando sólo se publicaba el
 * total de válidas. Este estudio declara `sexo = F/M` y `p01 = 1/2/3`, que
 * aceptan todos los valores posibles de su variable.
 */

const num = (v: unknown): number | null => {
  const c = Array.isArray(v) ? v[0] : v;
  if (c === null || c === undefined || c === "") return null;
  const n = typeof c === "number" ? c : Number(c);
  return Number.isFinite(n) ? n : null;
};

const texto = (v: unknown): string => {
  const c = Array.isArray(v) ? v[0] : v;
  return typeof c === "string" ? c : "";
};

export type PasoDeFiltro = {
  orden: number;
  variable: string;
  valores: string[];
  entran: number;
  caen: number;
  quedan: number;
  caenSoloAqui: number;
};

export type CadenaDeFiltros = {
  declarados: number;
  aplicados: number;
  sinColumna: string[];
  entran: number;
  quedan: number;
  pasos: PasoDeFiltro[];
  /** Ninguno de los filtros aplicados descartó una sola respuesta. */
  nadieDescarta: boolean;
};

export function cadenaDeFiltros(crudo: unknown): CadenaDeFiltros {
  const raiz = (crudo ?? {}) as Record<string, unknown>;
  const pasos = (Array.isArray(raiz.pasos) ? raiz.pasos : []).flatMap((p) => {
    const x = (p ?? {}) as Record<string, unknown>;
    const variable = texto(x.variable);
    if (!variable) return [];
    const valores = Array.isArray(x.valores)
      ? x.valores.map((v) => texto(v)).filter(Boolean)
      : [];
    return [{
      orden: num(x.orden) ?? 0,
      variable,
      valores,
      entran: num(x.entran) ?? 0,
      caen: num(x.caen) ?? 0,
      quedan: num(x.quedan) ?? 0,
      caenSoloAqui: num(x.caen_solo_aqui) ?? 0,
    }];
  });

  const sinColumna = (Array.isArray(raiz.sin_columna) ? raiz.sin_columna : [])
    .map((e) => texto((e as Record<string, unknown>)?.variable))
    .filter(Boolean);

  return {
    declarados: num(raiz.declarados) ?? 0,
    aplicados: num(raiz.aplicados) ?? 0,
    sinColumna,
    entran: num(raiz.entran) ?? 0,
    quedan: num(raiz.quedan) ?? 0,
    pasos,
    // Sólo cuenta si hay pasos: sin filtros aplicados no es que «nadie
    // descarte», es que no hay cadena.
    nadieDescarta: pasos.length > 0 && pasos.every((p) => p.caen === 0),
  };
}
