// «Casos junto al porcentaje» (ajuste del informe, aprobado por Gonzalo 2026-10-11). Vive en el preset base como
// `casos_junto = { cuando, umbral }`; el motor lo lee en graficos_casos_junto.R. Sin clave = el defecto (menos de 30).

import { conArg, PRESET_BASE, type MapaPresets } from "./modeloEstiloInforme";

export type CuandoCasos = "menos" | "siempre" | "nunca";
export type CasosJunto = { cuando: CuandoCasos; umbral: number };

export const ARG_CASOS = "casos_junto";
export const CASOS_POR_DEFECTO: CasosJunto = { cuando: "menos", umbral: 30 };

export const OPCIONES_CASOS: readonly { valor: CuandoCasos; rotulo: string }[] = [
  { valor: "menos", rotulo: "Sólo en grupos chicos" },
  { valor: "siempre", rotulo: "Siempre" },
  { valor: "nunca", rotulo: "Nunca" },
];

/** El ajuste vigente; lo que no se entiende vuelve al defecto (como el motor). */
export function leerCasosJunto(presets: MapaPresets): CasosJunto {
  const base = presets[PRESET_BASE];
  const crudo = base && typeof base === "object" ? (base as Record<string, unknown>)[ARG_CASOS] : undefined;
  const r = crudo && typeof crudo === "object" ? (crudo as Record<string, unknown>) : {};
  const cuando = OPCIONES_CASOS.some((o) => o.valor === r.cuando) ? (r.cuando as CuandoCasos) : CASOS_POR_DEFECTO.cuando;
  const n = Number(r.umbral);
  return { cuando, umbral: Number.isFinite(n) && n >= 1 ? Math.round(n) : CASOS_POR_DEFECTO.umbral };
}

/** Guarda el ajuste; igual al defecto, la clave se borra (sólo se guardan decisiones). */
export function conCasosJunto(presets: MapaPresets, casos: CasosJunto): MapaPresets {
  const igual = casos.cuando === CASOS_POR_DEFECTO.cuando && casos.umbral === CASOS_POR_DEFECTO.umbral;
  return conArg(presets, PRESET_BASE, ARG_CASOS, igual ? undefined : { ...casos }, undefined);
}

/** Cómo se lee el ajuste en una frase, para la ayuda y el «Cómo leer». */
export function fraseCasos(c: CasosJunto): string {
  if (c.cuando === "siempre") return "Cada porcentaje va con su número de casos, por ejemplo, 43% (12).";
  if (c.cuando === "nunca") return "Los porcentajes van solos, sin el número de casos.";
  return `Cuando un grupo tiene menos de ${c.umbral} casos, sus porcentajes van con el número de casos, por ejemplo, 43% (12).`;
}
