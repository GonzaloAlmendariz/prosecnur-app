// Etiquetas de las categorías de una variable, para LEER la tabla de metas.
//
// La lectura de valores de una columna (`/api/analitica/column-values`) solo
// trae etiqueta cuando la base la lleva pegada a la columna. En una base que
// guarda códigos, la tabla mostraba "1", "2", "3". Las etiquetas del formulario
// llegan por la revisión de variables (`/api/analitica/data-review`), que es la
// que usan Datos y Orden de categorías.
//
// La etiqueta es solo lo que se lee. El cruce con lo que devuelve el motor
// sigue siendo por código (metasModelo.ts) y las metas se guardan por código.

import type { DataReviewVariable, ValorColumna } from "../../../api/analitica";

/** variable → código → etiqueta. */
export type EtiquetasDelFormulario = Record<string, Record<string, string>>;

export function indiceDeEtiquetas(variables: readonly DataReviewVariable[]): EtiquetasDelFormulario {
  const indice: EtiquetasDelFormulario = {};
  for (const v of variables) {
    const porCodigo: Record<string, string> = {};
    for (const o of v.opciones ?? []) {
      const etiqueta = String(o.label ?? "").trim();
      if (etiqueta) porCodigo[String(o.code)] = etiqueta;
    }
    if (Object.keys(porCodigo).length) indice[v.name] = porCodigo;
  }
  return indice;
}

/**
 * Los valores de una columna con la etiqueta que se lee. Manda la que la base
 * trae pegada; si la base solo trae el código, la del formulario; si tampoco
 * hay, el código. `value` no se toca nunca.
 */
export function conEtiquetas(
  valores: readonly ValorColumna[],
  delFormulario: Record<string, string> | undefined,
): ValorColumna[] {
  return valores.map((v) => {
    const propia = String(v.label ?? "").trim();
    if (propia && propia !== v.value) return { value: v.value, label: propia };
    return { value: v.value, label: delFormulario?.[v.value] ?? v.value };
  });
}

/** El código se muestra junto a la etiqueta solo cuando dicen cosas distintas. */
export function codigoVisible(valor: ValorColumna): string | null {
  return valor.label && valor.label !== valor.value ? valor.value : null;
}
