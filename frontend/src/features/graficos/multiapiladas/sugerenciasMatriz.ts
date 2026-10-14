// P20 (enmienda al ADR 0103, «la matriz sugiere, la lámina decide»): en «Comparar públicos por tema», la matriz de
// equivalencias propone la pregunta de cada público vacío a partir de las que el tema ya tiene. Proponer no es aplicar:
// la línea sigue vacía hasta que el analista acepta.
//
// ADR 0104: sólo se sugiere lo declarado. La fuerza «parecida» —que salía del emparejado automático por enunciado y de
// las filas `sugerida` sin confirmar— se retiró: una fila que nadie confirmó no propone nada.

import type { EquivalenciaFila } from "../../../api/equivalencias";
import type { VarWithSource } from "../useVariables";
import { formatVarRef, parseVarRef } from "../useVariables";
import { otraEscala, refDePublico, type TemaPublicos } from "./temasPublicos";

export type SugerenciaPublico = {
  ref: string;
  etiquetaEstandar: string;
  /** La sugerida tiene otra escala que la primera del tema: se muestra, pero no entra en lote. */
  otraEscala: boolean;
};

/** Lo que la matriz sabe: sólo las filas que la persona confirmó. */
export type FuentesMatriz = {
  confirmadas: readonly EquivalenciaFila[];
};

export const SIN_MATRIZ: FuentesMatriz = { confirmadas: [] };

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const texto = (x: unknown): string => {
  if (Array.isArray(x)) return x.length ? texto(x[0]) : "";
  if (typeof x === "string") return x.trim();
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  return "";
};

/** Normaliza una fila de la matriz con lo mínimo que esta lógica lee; tolera las formas de R (escalares como arreglos). */
export function filaMinima(x: unknown): EquivalenciaFila | null {
  if (!esObjeto(x)) return null;
  const variables: Record<string, string> = {};
  if (esObjeto(x.variables)) {
    for (const [base, v] of Object.entries(x.variables)) {
      const t = texto(v);
      if (base && t) variables[base] = t;
    }
  }
  if (Object.keys(variables).length < 2) return null;
  const sugeridaCruda = Array.isArray(x.sugerida) ? x.sugerida[0] : x.sugerida;
  return {
    seccion: texto(x.seccion),
    etiqueta_estandar: texto(x.etiqueta_estandar),
    variables,
    cantidad: Object.keys(variables).length,
    ...(sugeridaCruda === true ? { sugerida: true } : {}),
  };
}

/**
 * Las filas confirmadas de la matriz. Una fila `sugerida` (propuesta de una versión anterior que nadie confirmó) no
 * entra: no es una declaración y ADR 0104 retira toda sugerencia que no nazca de una.
 */
export function fuentesDeMatriz(filasMatriz: readonly unknown[]): FuentesMatriz {
  const matriz = filasMatriz.map(filaMinima).filter((f): f is EquivalenciaFila => f !== null);
  return { confirmadas: matriz.filter((f) => !f.sugerida) };
}

const existe = (variables: readonly VarWithSource[], base: string, name: string) =>
  variables.some((v) => v.source === base && v.name === name);

/** La primera fila que contiene alguna pregunta del tema y nombra una variable existente para `publico`. */
function filaParaPublico(
  filas: readonly EquivalenciaFila[],
  anclas: readonly { source: string; name: string }[],
  publico: string,
  variables: readonly VarWithSource[],
): EquivalenciaFila | undefined {
  for (const ancla of anclas) {
    const fila = filas.find((f) => {
      if (f.variables[ancla.source] !== ancla.name) return false;
      const destino = f.variables[publico];
      return !!destino && existe(variables, publico, destino);
    });
    if (fila) return fila;
  }
  return undefined;
}

/** Para cada público vacío del tema, la pregunta que la matriz propone (si la hay). */
export function sugerenciasDeTema(
  tema: TemaPublicos,
  publicos: readonly string[],
  variables: readonly VarWithSource[],
  fuentes: FuentesMatriz,
): Record<string, SugerenciaPublico> {
  const anclas = tema.vars
    .map((r) => parseVarRef(r))
    .filter((r): r is { source: string; name: string } => !!r.source && !!r.name);
  const out: Record<string, SugerenciaPublico> = {};
  if (!anclas.length) return out;
  for (const p of publicos) {
    if (refDePublico(tema, p)) continue;
    const fila = filaParaPublico(fuentes.confirmadas, anclas, p, variables);
    if (!fila) continue;
    const ref = formatVarRef(p, fila.variables[p], true);
    out[p] = {
      ref,
      etiquetaEstandar: fila.etiqueta_estandar,
      otraEscala: otraEscala(variables, tema, ref),
    };
  }
  return out;
}

/** Las que «Completar con la matriz» aplica de una vez: las de la misma escala. */
export function aplicablesEnLote(sugerencias: Record<string, SugerenciaPublico>): SugerenciaPublico[] {
  return Object.values(sugerencias).filter((s) => !s.otraEscala);
}
