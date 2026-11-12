// Analítica › Dimensiones: lo que la pantalla lee de la estructura guardada
// (`config.dimensiones`) y de lo que el motor publica al calcularla
// (`/dimensiones/preview`, cobertura por columna `idx_*` y `sub_*`).
//
// Ninguna cifra se calcula aquí: el puntaje medio, la desviación y los casos
// salen de la cobertura del motor, cruzada por el nombre de la columna. Lo que
// el motor no publica (puntaje por pregunta, distribución) no se suple.

import type { DimensionesCobertura, DimensionesEscalaDetectada } from "../../../api/dashboard";
import type { BloqueConfig, DimensionesConfig } from "../store";

export type TipoDeDimension = "indice" | "bloque";

export type BloqueDeDimension = {
  nombre: string;
  etiqueta: string;
  /** La columna que el motor escribe: `sub_<nombre>`. */
  columna: string;
  /** Las preguntas del bloque, sin el prefijo de la recodificación. */
  preguntas: string[];
  cobertura: DimensionesCobertura | null;
};

export type EntradaDeDimension = {
  tipo: TipoDeDimension;
  nombre: string;
  etiqueta: string;
  /** `idx_<nombre>` o `sub_<nombre>`; es la clave del foco. */
  columna: string;
  /** Un índice lista sus bloques; un bloque suelto, solo él. */
  bloques: BloqueDeDimension[];
  cobertura: DimensionesCobertura | null;
};

export type CifrasDeDimensiones = {
  indices: number;
  bloques: number;
  /** Preguntas distintas dentro de algún bloque. */
  preguntasEnBloque: number;
  /** Preguntas de las listas de escala elegidas; null si no se pudieron leer. */
  preguntasDeEscala: number | null;
};

export const columnaDeIndice = (nombre: string) => `idx_${nombre}`;
export const columnaDeBloque = (nombre: string) => `sub_${nombre}`;

/** La pregunta de una columna recodificada: `r100_A1_leg` da `A1_leg`. */
export function preguntaDeColumna(columna: string, prefijo: string): string {
  return prefijo && columna.startsWith(prefijo) ? columna.slice(prefijo.length) : columna;
}

function coberturaPorColumna(cobertura: readonly DimensionesCobertura[]): Map<string, DimensionesCobertura> {
  return new Map(cobertura.map((c) => [c.var, c]));
}

function bloqueDeDimension(b: BloqueConfig, dim: DimensionesConfig, porColumna: Map<string, DimensionesCobertura>): BloqueDeDimension {
  const columna = columnaDeBloque(b.nombre);
  return {
    nombre: b.nombre,
    etiqueta: dim.labels_subindices[b.nombre] || b.etiqueta || b.nombre,
    columna,
    preguntas: b.vars.map((v) => preguntaDeColumna(v, dim.prefijo)),
    cobertura: porColumna.get(columna) ?? null,
  };
}

/**
 * Los índices en el orden de la estructura y, después, los bloques que ningún
 * índice usa (el motor calcula un bloque aunque no forme índice). Un índice que
 * nombra un bloque inexistente lo omite, como el motor.
 */
export function entradasDeDimensiones(dim: DimensionesConfig, cobertura: readonly DimensionesCobertura[]): EntradaDeDimension[] {
  const porColumna = coberturaPorColumna(cobertura);
  const bloques = new Map(dim.subindices.map((b) => [b.nombre, bloqueDeDimension(b, dim, porColumna)]));
  const usados = new Set<string>();
  const indices: EntradaDeDimension[] = dim.indices.map((i) => {
    const suyos = i.subindices.flatMap((n) => {
      const b = bloques.get(n);
      if (!b) return [];
      usados.add(n);
      return [b];
    });
    const columna = columnaDeIndice(i.nombre);
    return {
      tipo: "indice",
      nombre: i.nombre,
      etiqueta: dim.labels_indices[i.nombre] || i.etiqueta || i.nombre,
      columna,
      bloques: suyos,
      cobertura: porColumna.get(columna) ?? null,
    };
  });
  const sueltos: EntradaDeDimension[] = [...bloques.values()]
    .filter((b) => !usados.has(b.nombre))
    .map((b) => ({ tipo: "bloque", nombre: b.nombre, etiqueta: b.etiqueta, columna: b.columna, bloques: [b], cobertura: b.cobertura }));
  return [...indices, ...sueltos];
}

/** Preguntas distintas de una entrada, en el orden de sus bloques. */
export function preguntasDeLaEntrada(e: EntradaDeDimension): string[] {
  return [...new Set(e.bloques.flatMap((b) => b.preguntas))];
}

/** Las listas de escala elegidas y sus preguntas, sin las excluidas. */
function preguntasDeLasListas(dim: DimensionesConfig, escalas: readonly DimensionesEscalaDetectada[]): string[] {
  const listas = new Set(dim.listas_objetivo);
  const excluidas = new Set(dim.excluir_vars);
  return [...new Set(escalas.filter((e) => listas.has(e.list_name)).flatMap((e) => e.vars))].filter((v) => !excluidas.has(v));
}

/** Preguntas de las listas de escala elegidas que no están en ningún bloque. */
export function preguntasSinBloque(dim: DimensionesConfig, escalas: readonly DimensionesEscalaDetectada[]): string[] {
  const enBloque = new Set(dim.subindices.flatMap((b) => b.vars.map((v) => preguntaDeColumna(v, dim.prefijo))));
  return preguntasDeLasListas(dim, escalas).filter((v) => !enBloque.has(v));
}

/** Las listas de escala de las que salen las preguntas de una entrada. */
export function listasDeLaEntrada(e: EntradaDeDimension, escalas: readonly DimensionesEscalaDetectada[]): string[] {
  const preguntas = new Set(preguntasDeLaEntrada(e));
  return escalas.filter((s) => s.vars.some((v) => preguntas.has(v))).map((s) => s.list_name);
}

export function cifrasDeDimensiones(dim: DimensionesConfig, escalas: readonly DimensionesEscalaDetectada[] | null): CifrasDeDimensiones {
  const enBloque = new Set(dim.subindices.flatMap((b) => b.vars.map((v) => preguntaDeColumna(v, dim.prefijo))));
  if (!escalas) {
    return { indices: dim.indices.length, bloques: dim.subindices.length, preguntasEnBloque: enBloque.size, preguntasDeEscala: null };
  }
  // Numerador y base sobre el mismo conjunto: las preguntas de las listas de escala.
  const deEscala = preguntasDeLasListas(dim, escalas);
  return {
    indices: dim.indices.length,
    bloques: dim.subindices.length,
    preguntasEnBloque: deEscala.filter((v) => enBloque.has(v)).length,
    preguntasDeEscala: deEscala.length,
  };
}

/**
 * La entrada del foco: la de esa columna o, si es un bloque dentro de un
 * índice, su índice. Sin foco o con uno que ya no existe, la primera.
 */
export function entradaElegida(entradas: readonly EntradaDeDimension[], foco: string | null): EntradaDeDimension | null {
  return entradas.find((e) => e.columna === foco)
    ?? entradas.find((e) => e.bloques.some((b) => b.columna === foco))
    ?? entradas[0]
    ?? null;
}
