// Ponderación de cada base de una serie de mediciones: lógica pura.
//
// La consumen Carga › Equivalencias (paso «Ponderación» del recorrido de la
// serie) y Analítica › Comparativos (la línea de estado y el aviso previo a
// generar). Una sola lectura para las dos vistas: si dijeran cosas distintas de
// la misma base, el analista no sabría a cuál creerle.

import type { PonderacionDeBase, PonderacionPorBase } from "../../api/ponderacionBases";
import { serializarDireccion } from "../../lib/navegacion/direccion";

export const DIRECCION_PONDERACION_SERIE = serializarDireccion({
  modulo: "procesamiento",
  seccion: "analitica",
  pestana: "ponderacion",
});

export type PonderacionEnSerie = { base: string; ponderacion: PonderacionDeBase };

/**
 * Estado de cada base de la serie. Con la lectura de todas las bases
 * (`PonderacionPorBase`) cada una trae lo suyo; con la de la base activa sola,
 * las demás quedan «sin leer». Lectura nula: falló o no terminó, y nada se supone.
 */
export function ponderacionDeLaSerie(
  bases: readonly string[],
  activa: string | null | undefined,
  lectura: PonderacionDeBase | PonderacionPorBase | null,
): PonderacionEnSerie[] {
  const porBase = lectura && !("tipo" in lectura) ? (lectura as PonderacionPorBase) : null;
  const activaSola = lectura && "tipo" in lectura ? (lectura as PonderacionDeBase) : null;
  return bases.map((base) => ({
    base,
    ponderacion: porBase
      ? porBase[base] ?? { tipo: "sin_leer" }
      : base === activa && activaSola ? activaSola : { tipo: "sin_leer" },
  }));
}

/** Columnas entre comillas: «a», «a» y «b»; con más, cuántas. */
function columnasEnPalabras(columnas: readonly string[]): string {
  if (columnas.length > 2) return `${columnas.length} columnas de peso`;
  return enPalabras(columnas.map((c) => `«${c}»`));
}

/**
 * Una base sin declarar que trae columnas de peso, o de la que no se sabe si
 * las trae: falta declararla. Sin declarar y sin columnas de peso no falta
 * nada: no hay peso que declarar y sale sin ponderar.
 */
export function pendienteDeDeclarar(p: PonderacionDeBase): boolean {
  return p.tipo === "sin_declarar" && (p.columnasPeso === null || p.columnasPeso.length > 0);
}

/** Sin declarar y sin columnas de peso: un hecho, igual que «sin ponderar». */
function sinPesoQueDeclarar(p: PonderacionDeBase): boolean {
  return p.tipo === "sin_declarar" && p.columnasPeso !== null && p.columnasPeso.length === 0;
}

/**
 * Texto corto de una base: «columna «peso»», «calibración», «sin ponderar»,
 * «trae «factor» sin declarar».
 */
export function textoPonderacion(p: PonderacionDeBase): string {
  switch (p.tipo) {
    case "columna":
      return p.columna ? `columna «${p.columna}»` : "por columna";
    case "calibracion":
      return "calibración";
    case "sin_ponderar":
      return "sin ponderar";
    case "sin_declarar":
      if (p.columnasPeso === null) return "sin peso declarado";
      if (!p.columnasPeso.length) return "sin ponderar";
      return `trae ${columnasEnPalabras(p.columnasPeso)} sin declarar`;
    case "sin_leer":
      return "sin leer aquí";
  }
}

/** Qué dice cada estado, para el `title` (el puntero) y el lector de pantalla. */
export function explicacionPonderacion(p: PonderacionDeBase): string {
  switch (p.tipo) {
    case "columna":
      return "Pondera con una columna de peso que la base ya trae.";
    case "calibracion":
      return "Pondera por calibración a márgenes de la población.";
    case "sin_ponderar":
      return "Declarada sin ponderar: cada caso pesa 1.";
    case "sin_declarar":
      if (p.columnasPeso === null) {
        return "No declara su ponderación. El comparativo sale sin ponderar, o se detiene si la base trae una columna «peso».";
      }
      if (!p.columnasPeso.length) return "No trae columna de peso: cada caso pesa 1 (sin ponderar).";
      return `Trae ${columnasEnPalabras(p.columnasPeso)} y no declara cómo pondera: ${consecuencia([p], 1)}. Decláralo en Analítica › Ponderación.`;
    case "sin_leer":
      return "Se ve en Analítica › Ponderación con esta base activa.";
  }
}

/** Clase de estado de una base en la línea de Comparativos. */
export function clasePonderacion(p: PonderacionDeBase): string {
  if (sinPesoQueDeclarar(p)) return "is-sin-ponderar";
  return `is-${p.tipo.replace("_", "-")}`;
}

/**
 * Una base está resuelta si declaró cómo pondera, incluso «sin ponderar», o si
 * no trae ninguna columna de peso que declarar.
 */
export function ponderacionResuelta(p: PonderacionDeBase): boolean {
  return p.tipo === "columna" || p.tipo === "calibracion" || p.tipo === "sin_ponderar" || sinPesoQueDeclarar(p);
}

/** Bases a las que les falta declarar su peso (`pendienteDeDeclarar`). */
export function basesSinDeclarar(serie: readonly PonderacionEnSerie[]): string[] {
  return serie.filter((s) => pendienteDeDeclarar(s.ponderacion)).map((s) => s.base);
}

export function basesSinLeer(serie: readonly PonderacionEnSerie[]): string[] {
  return serie.filter((s) => s.ponderacion.tipo === "sin_leer").map((s) => s.base);
}

/** «a», «a y b», «a, b y c». */
export function enPalabras(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * Las bases pendientes en una frase corta, para el Recorrido y el aviso: con
 * una, la base y lo que trae; con dos, sus nombres; con más, cuántas. El texto
 * no crece con el número de bases (C2).
 */
export function pendientesEnPalabras(serie: readonly PonderacionEnSerie[]): string | null {
  const pendientes = serie.filter((s) => pendienteDeDeclarar(s.ponderacion));
  if (!pendientes.length) return null;
  if (pendientes.length === 1) return `${pendientes[0].base} ${textoPonderacion(pendientes[0].ponderacion)}`;
  const sujeto = pendientes.length === 2
    ? enPalabras(pendientes.map((s) => s.base))
    : `${pendientes.length} bases`;
  const conocidas = pendientes.every((s) => s.ponderacion.tipo === "sin_declarar" && s.ponderacion.columnasPeso !== null);
  return conocidas ? `${sujeto} traen columnas de peso sin declarar` : `${sujeto} sin peso declarado`;
}

/**
 * Qué hace el motor con las bases pendientes (`.armz_ponderar`): se detiene si
 * una trae la columna exacta «peso»; si no, la toma sin ponderar.
 */
function consecuencia(pendientes: readonly PonderacionDeBase[], n: number): string {
  const columnas = pendientes.map((p) => (p.tipo === "sin_declarar" ? p.columnasPeso : []));
  if (columnas.some((c) => c?.includes("peso"))) return "el comparativo se detiene";
  if (columnas.some((c) => c === null)) return "el comparativo sale sin ponderar, o se detiene si trae una columna «peso»";
  return n === 1 ? "el comparativo la toma sin ponderar" : "el comparativo las toma sin ponderar";
}

/**
 * Aviso previo a generar el comparativo, o `null` si no hace falta. Sólo
 * aparece si a alguna base le falta declarar su peso; una base sin columnas de
 * peso no avisa nada. No bloquea: el motor decide, y el aviso dice antes lo que
 * el motor va a hacer.
 */
export function avisoAntesDeGenerar(serie: readonly PonderacionEnSerie[]): string | null {
  const sujeto = pendientesEnPalabras(serie);
  if (!sujeto) return null;
  const pendientes = serie.filter((s) => pendienteDeDeclarar(s.ponderacion)).map((s) => s.ponderacion);
  return `${sujeto}: ${consecuencia(pendientes, pendientes.length)}.`;
}
