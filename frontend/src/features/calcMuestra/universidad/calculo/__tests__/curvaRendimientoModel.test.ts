import { describe, expect, it } from "vitest";
import { curvaRendimiento, etiquetaPeldano } from "../curvaRendimientoModel";

const fac = (tramos: Array<[number, number, number, number]>) => ({
  tramos: tramos.map(([tasa, n_aulas, desde, hasta]) => ({
    tasa,
    n_aulas,
    elegibles: n_aulas * desde,
    desde,
    hasta,
  })),
});

describe("curvaRendimiento", () => {
  it("une los tramos de todas las facultades en una sola curva, de chicas a grandes", () => {
    const curva = curvaRendimiento([
      fac([
        [0.8, 10, 4, 15],
        [0.56, 30, 26, 35],
      ]),
      fac([
        [0.8, 5, 6, 14],
        [0.44, 55, 51, 120],
      ]),
    ]);
    expect(curva.map((p) => p.tasa)).toEqual([0.8, 0.56, 0.44]);
    // El peldaño de las chicas suma las aulas de las dos facultades…
    expect(curva[0].nAulas).toBe(15);
    // …y su rango se estira para cubrir lo observado en ambas.
    expect(curva[0].desde).toBe(4);
    expect(curva[0].hasta).toBe(15);
    // La parte es sobre el marco entero: 15 + 30 + 55 = 100 aulas.
    expect(curva[0].parte).toBeCloseTo(0.15, 4);
    expect(curva[2].parte).toBeCloseTo(0.55, 4);
  });

  it("sin tramos publicados no inventa una curva de ejemplo", () => {
    expect(curvaRendimiento([])).toEqual([]);
    expect(curvaRendimiento([{ tramos: [] }])).toEqual([]);
    // Un solo peldaño no es una curva: el diagrama exige al menos dos y esto
    // deja que lo decida quien dibuja, devolviendo lo que hay sin rellenar.
    expect(curvaRendimiento([fac([[0.56, 3, 26, 35]])])).toHaveLength(1);
  });

  it("las etiquetas del rango se leen sin decimales ni jerga", () => {
    const curva = curvaRendimiento([
      fac([
        [0.8, 10, 4, 15],
        [0.56, 30, 26, 35],
        [0.44, 55, 51, 120],
      ]),
    ]);
    expect(etiquetaPeldano(curva[0], false, true)).toBe("hasta 15");
    expect(etiquetaPeldano(curva[1], false, false)).toBe("26 a 35");
    expect(etiquetaPeldano(curva[2], true, false)).toBe("más de 50");
  });
});
