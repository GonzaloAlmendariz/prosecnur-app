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
