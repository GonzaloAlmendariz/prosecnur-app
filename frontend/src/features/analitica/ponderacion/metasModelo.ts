// Metas de una variable de ajuste: lectura y edición como funciones puras.
//
// Son las mismas reglas que tenía el editor de categorías dentro del panel
// (unidad de las metas, "Usar muestra", "Igualar" y la escala de las barras),
// movidas aquí para probarlas sin montar la vista. Ninguna toca el cálculo de
// pesos: escriben las metas que el analista declara y leen lo que el motor
// devuelve por categoría.

import type { PonderMarginCompare, ValorColumna } from "../../../api/analitica";

export type MetasPorCategoria = Record<string, number>;

/** Las metas del censo llegan en conteos; las tecleadas, en porcentaje. */
export function metasEnConteos(metas: MetasPorCategoria): boolean {
  return Object.values(metas).reduce((a, b) => a + b, 0) > 101;
}

/** Escribe o borra la meta de una categoría. Un texto que no es número la borra. */
export function conMeta(metas: MetasPorCategoria, categoria: string, texto: string): MetasPorCategoria {
  const siguiente = { ...metas };
  const numero = Number.parseFloat(texto);
  if (texto === "" || !Number.isFinite(numero)) delete siguiente[categoria];
  else siguiente[categoria] = numero;
  return siguiente;
}

/** La fila que el motor devuelve para una categoría. Se cruza por su código, nunca por posición. */
export function comparacionDe(
  comparacion: readonly PonderMarginCompare[] | undefined,
  categoria: string,
): PonderMarginCompare | undefined {
  return comparacion?.find((fila) => fila.categoria === categoria);
}

/** "Usar muestra": las metas toman la distribución que la muestra ya tiene, en porcentaje. */
export function metasDesdeLaMuestra(
  categorias: readonly ValorColumna[],
  comparacion: readonly PonderMarginCompare[] | undefined,
): MetasPorCategoria {
  const metas: MetasPorCategoria = {};
  for (const c of categorias) {
    const fila = comparacionDe(comparacion, c.value);
    if (fila) metas[c.value] = +(fila.muestra * 100).toFixed(1);
  }
  return metas;
}

/** "Igualar": el mismo porcentaje para cada categoría. */
export function metasIguales(categorias: readonly ValorColumna[]): MetasPorCategoria {
  const metas: MetasPorCategoria = {};
  const k = categorias.length || 1;
  for (const c of categorias) metas[c.value] = +(100 / k).toFixed(1);
  return metas;
}

/**
 * La proporción que llena la pista de las barras de una variable. Nunca menos
 * de 0.4: con categorías chicas, una barra del 8 % no debe parecer mayoría.
 */
export function escalaDeBarras(comparacion: readonly PonderMarginCompare[] | undefined): number {
  return Math.max(0.4, ...(comparacion ?? []).flatMap((f) => [f.muestra, f.ponderado, f.objetivo]));
}

/** Una proporción (0 a 1) como porcentaje con un decimal, sin el signo: va bajo una cabecera que ya dice "%". */
export function porcentaje(proporcion: number): string {
  return (proporcion * 100).toFixed(1);
}
