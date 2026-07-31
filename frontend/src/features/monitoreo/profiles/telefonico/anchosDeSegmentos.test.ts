import { describe, expect, test } from "vitest";
import { anchosDeSegmentos } from "./telefonicoBase";

// Decisión 1 del goal visual. Las barras de insistencia daban 130, 129, 129 y
// 133 % en las cuatro filas medidas sobre `acnur_pdm`, y al pasar de 100 el
// apilado desbordaba y `overflow: hidden` recortaba el segmento dominante
// —justo el que más importa—.
//
// Estos tests fijan la propiedad que hacía falta y que ninguna de las dos
// causas cumplía: **el reparto cierra**. La pestaña «Sin efectiva» está
// bloqueada en el proyecto de referencia, así que la garantía vive acá y no en
// una captura.

describe("anchosDeSegmentos", () => {
  test("la distribución cierra en 100 con el caso que fallaba", () => {
    // La fila del hallazgo: buckets de 1+2+5 = 8 casos que se dividían entre 6.
    const anchos = anchosDeSegmentos([1, 2, 5]);
    expect(anchos.reduce((suma, x) => suma + x, 0)).toBeCloseTo(100, 6);
    // Y las proporciones son las reales, no las del denominador equivocado.
    expect(anchos).toEqual([12.5, 25, 62.5]);
  });

  test("el suelo de visibilidad no rompe el cierre", () => {
    // Seis segmentos con cinco diminutos: aplicar el suelo y ya daba 100 + 5×3.
    const anchos = anchosDeSegmentos([1000, 1, 1, 1, 1, 1]);
    expect(anchos.reduce((suma, x) => suma + x, 0)).toBeCloseTo(100, 6);
    // Los chicos siguen siendo visibles y el dominante sigue dominando.
    expect(Math.min(...anchos)).toBeGreaterThan(0);
    expect(anchos[0]).toBeGreaterThan(50);
  });

  test("un segmento en cero no ocupa ancho", () => {
    const anchos = anchosDeSegmentos([3, 0, 1]);
    expect(anchos[1]).toBe(0);
    expect(anchos.reduce((suma, x) => suma + x, 0)).toBeCloseTo(100, 6);
  });

  test("sin datos no inventa reparto", () => {
    expect(anchosDeSegmentos([0, 0, 0])).toEqual([0, 0, 0]);
    expect(anchosDeSegmentos([])).toEqual([]);
  });

  test("ignora valores no finitos y negativos en vez de propagarlos", () => {
    const anchos = anchosDeSegmentos([2, Number.NaN, -5, 2]);
    expect(anchos[1]).toBe(0);
    expect(anchos[2]).toBe(0);
    expect(anchos.reduce((suma, x) => suma + x, 0)).toBeCloseTo(100, 6);
  });
});
