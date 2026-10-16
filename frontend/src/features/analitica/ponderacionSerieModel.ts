// Ponderación de cada base de una serie de mediciones: lógica pura.
//
// La consumen Carga › Equivalencias (paso «Ponderación» del recorrido de la
// serie) y Analítica › Comparativos (la línea de estado y el aviso previo a
// generar). Una sola lectura para las dos vistas: si dijeran cosas distintas de
// la misma base, el analista no sabría a cuál creerle.

import type { PonderacionDeBase } from "../../api/ponderacionBases";
import { serializarDireccion } from "../../lib/navegacion/direccion";

export const DIRECCION_PONDERACION_SERIE = serializarDireccion({
  modulo: "procesamiento",
  seccion: "analitica",
  pestana: "ponderacion",
});

export type PonderacionEnSerie = { base: string; ponderacion: PonderacionDeBase };

/**
 * Estado de cada base de la serie. Hoy sólo se lee la base activa; las demás
 * quedan «sin leer» (ver `api/ponderacionBases.ts`). `lecturaActiva` nula: la
 * lectura falló o no terminó, y la activa tampoco se supone.
 */
export function ponderacionDeLaSerie(
  bases: readonly string[],
  activa: string | null | undefined,
  lecturaActiva: PonderacionDeBase | null,
): PonderacionEnSerie[] {
  return bases.map((base) => ({
    base,
    ponderacion: base === activa && lecturaActiva ? lecturaActiva : { tipo: "sin_leer" },
  }));
}

/** Texto corto de una base: «columna «peso»», «calibración», «sin peso declarado». */
export function textoPonderacion(p: PonderacionDeBase): string {
  switch (p.tipo) {
    case "columna":
      return p.columna ? `columna «${p.columna}»` : "por columna";
    case "calibracion":
      return "calibración";
    case "sin_ponderar":
      return "sin ponderar";
    case "sin_declarar":
      return "sin peso declarado";
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
      return "No declara su ponderación. El comparativo sale sin ponderar, o se detiene si la base trae una columna «peso».";
    case "sin_leer":
      return "Se ve en Analítica › Ponderación con esta base activa.";
  }
}

/** Una base está resuelta si declaró cómo pondera, incluso «sin ponderar». */
export function ponderacionResuelta(p: PonderacionDeBase): boolean {
  return p.tipo === "columna" || p.tipo === "calibracion" || p.tipo === "sin_ponderar";
}

export function basesSinDeclarar(serie: readonly PonderacionEnSerie[]): string[] {
  return serie.filter((s) => s.ponderacion.tipo === "sin_declarar").map((s) => s.base);
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
 * Aviso previo a generar el comparativo, o `null` si no hace falta. No bloquea:
 * el motor decide, y el aviso dice antes lo que el motor va a hacer.
 */
export function avisoAntesDeGenerar(serie: readonly PonderacionEnSerie[]): string | null {
  const faltan = basesSinDeclarar(serie);
  if (!faltan.length) return null;
  const sujeto = faltan.length === 1 ? `${faltan[0]} no declara` : `${enPalabras(faltan)} no declaran`;
  return `${sujeto} su ponderación: sale sin ponderar, o el comparativo se detiene si trae una columna «peso».`;
}
