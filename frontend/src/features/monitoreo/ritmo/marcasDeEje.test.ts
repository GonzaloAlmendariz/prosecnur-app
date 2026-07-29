import { describe, expect, it } from "vitest";

import { marcasDeEje, pasoDeEje } from "./marcasDeEje";

// Los números de referencia salen de medir el gráfico real de acrconta en
// Avance: alto 360, márgenes 36 arriba y 86 abajo, rango [0, 64] a la izquierda
// y [0, 500] a la derecha. Si estas marcas no caen donde Plotly pone las suyas,
// el eje dibujado al lado del scroll miente sobre las barras que acompaña.

describe("pasoDeEje", () => {
  it("elige los mismos pasos redondos que Plotly", () => {
    expect(pasoDeEje(64)).toBe(10);
    expect(pasoDeEje(500)).toBe(100);
    expect(pasoDeEje(8)).toBe(1);
    expect(pasoDeEje(25)).toBe(5);
  });

  it("no devuelve paso cero ante un máximo degenerado", () => {
    // Un paso de 0 colgaría el bucle que genera las marcas.
    expect(pasoDeEje(0)).toBeGreaterThan(0);
    expect(pasoDeEje(-5)).toBeGreaterThan(0);
    expect(pasoDeEje(Number.NaN)).toBeGreaterThan(0);
  });
});

describe("marcasDeEje", () => {
  it("ancla el cero abajo y el máximo arriba del área de trazado", () => {
    const marcas = marcasDeEje(64, 360, 36, 86);
    const cero = marcas.find((m) => m.valor === 0)!;
    // El área va de 36 a 274 (360 − 36 − 86 = 238 de alto).
    expect(cero.y).toBeCloseTo(274, 5);
    expect(marcas.at(-1)!.y).toBeLessThan(cero.y);
  });

  it("reparte las marcas con el espaciado que se midió en pantalla", () => {
    // Plotly dibujaba una marca cada ~37 px para este eje.
    const marcas = marcasDeEje(64, 360, 36, 86);
    const separacion = marcas[0].y - marcas[1].y;
    expect(separacion).toBeGreaterThan(36);
    expect(separacion).toBeLessThan(38);
  });

  it("cubre el rango sin pasarse del máximo", () => {
    const marcas = marcasDeEje(500, 360, 36, 86);
    expect(marcas.map((m) => m.valor)).toEqual([0, 100, 200, 300, 400, 500]);
  });

  it("no dibuja eje cuando no hay alto útil ni escala", () => {
    // Márgenes que se comen el alto: mejor ningún eje que todas las marcas
    // apiladas en el mismo píxel.
    expect(marcasDeEje(64, 100, 60, 60)).toEqual([]);
    expect(marcasDeEje(0, 360, 36, 86)).toEqual([]);
  });

  it("formatea con separador de miles", () => {
    const marcas = marcasDeEje(5000, 360, 36, 86);
    expect(marcas.at(-1)!.etiqueta).toBe("5,000");
  });
});
