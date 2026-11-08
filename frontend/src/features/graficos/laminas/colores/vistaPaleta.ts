// Muestras de la paleta en la tarjeta del gráfico (ítem 8 de la oleada del inspector, 2026-11-08): cada paleta con nombre
// se pinta sobre las respuestas de ESTA pregunta, y se dice a cuántas preguntas alcanza antes de elegirla. Puro: lo usan
// MuestrasPaleta.tsx y la vista previa de la barra de PaletaDelGrafico.tsx.

import { normalizarEtiquetaPaleta } from "../../paletasResolver";
import type { FilaPaleta } from "../../estilo/modeloPaletasConNombre";

/**
 * Los colores con que saldrían estas respuestas con la paleta `destino`: el de la paleta para cada respuesta que nombra
 * (sin distinguir caja, tildes ni espacios, como el motor) y, si no la nombra, el que ya tenía (`conAgrupado` toma de la
 * pregunta lo que a la paleta le falta).
 */
export function coloresConPaleta(opciones: readonly string[], propios: Readonly<Record<string, string>>, destino: Pick<FilaPaleta, "colores">): Record<string, string> {
  const deLaPaleta = new Map(Object.entries(destino.colores).map(([o, c]) => [normalizarEtiquetaPaleta(o), c]));
  const out: Record<string, string> = {};
  for (const o of opciones) {
    const c = deLaPaleta.get(normalizarEtiquetaPaleta(o)) ?? propios[o];
    if (c) out[o] = c;
  }
  return out;
}

/** Lo que dice cada muestra antes del clic: la elegida, «en uso»; las demás, cuántas preguntas cambian. */
export function alcanceDeLaPaleta(enUso: boolean, preguntas: number): string {
  if (enUso) return "En uso";
  return preguntas === 1 ? "Cambia 1 pregunta" : `Cambia ${preguntas} preguntas`;
}

/** Cuántas de estas respuestas nombra la paleta (sin distinguir caja, tildes ni espacios, como el motor). */
export function respuestasEnComun(opciones: readonly string[], destino: Pick<FilaPaleta, "colores">): number {
  const nombradas = new Set(Object.keys(destino.colores).map(normalizarEtiquetaPaleta));
  return opciones.filter((o) => nombradas.has(normalizarEtiquetaPaleta(o))).length;
}

/**
 * R6-3: las paletas en el orden de las muestras. Las que nombran alguna de estas respuestas primero (en su orden); las que
 * no nombran ninguna, al final: elegirlas no cambiaría ningún color de esta pregunta y su muestra sería igual a la barra.
 */
export function muestrasEnOrden<T extends Pick<FilaPaleta, "colores">>(opciones: readonly string[], paletas: readonly T[]): { paleta: T; ajena: boolean }[] {
  const con = paletas.map((paleta) => ({ paleta, ajena: respuestasEnComun(opciones, paleta) === 0 }));
  return [...con.filter((x) => !x.ajena), ...con.filter((x) => x.ajena)];
}

/** Lo que dice la muestra de una paleta que no nombra estas respuestas, en lugar de cuántas preguntas cambian. */
export const ALCANCE_AJENA = "Para otras respuestas";
