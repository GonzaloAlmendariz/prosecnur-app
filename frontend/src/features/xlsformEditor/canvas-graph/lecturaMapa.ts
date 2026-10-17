// Lectura de las reglas del Mapa de lógica (S6/S7, 2026-10-17): el detalle del nodo y el panel de una conexión leen
// con el motor (`reglas/motor`), la misma voz del riel, Restricciones y Filtros. Antes armaban su propio semi-código
// (««1. ¿Cuál es…» (TOI01) ≠ 'Descarga…' y …»). Lo que el motor no sabe leer se dice técnico, con el código.

import type { BuilderStructure, CatalogSummary } from "../types";
import { enriquecerAlcance, type LogicScope } from "../logic";
import { alcanceDeLectura } from "../kit/alcanceLectura";
import { describeExpression } from "../canvas/reglasHumanas";

export function alcanceDelMapa(structure: BuilderStructure | null, catalogs: readonly CatalogSummary[]): LogicScope {
  return enriquecerAlcance(alcanceDeLectura(structure, catalogs), structure);
}

/** Frase de una condición del Mapa. `codigo`: el texto técnico que se muestra si el motor no la reconoce. */
export function lecturaDelMapa(expr: string, alcance: LogicScope, codigo: () => string): string {
  const lectura = describeExpression(expr, alcance);
  if (!lectura.technical) return lectura.aviso ? `${lectura.summary} (${lectura.aviso})` : lectura.summary;
  return `Regla técnica: ${codigo()}`;
}
