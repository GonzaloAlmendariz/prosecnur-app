import { describe, expect, it } from "vitest";
import { curvaRendimiento, etiquetaPeldano } from "../curvaRendimientoModel";
import { resumenTasaEfectividad } from "../estadisticoAula";

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

describe("resumenTasaEfectividad", () => {
  it("anuncia el rango cuando cada facultad dimensiona con la suya", () => {
    // Medido en el marco 2026: EE.GG. Ciencias 0,4346 y Letras y Ciencias
    // Humanas 0,7385. Un chip que dijera «53%» entre z, p, e y deff pondría al
    // mismo nivel un parámetro que ninguna facultad está usando.
    const r = resumenTasaEfectividad(
      [{ tau: 0.4346 }, { tau: 0.5679 }, { tau: 0.7385 }],
      0.53,
    );
    expect(r.valor).toBe("43%–74%");
    expect(r.nota).toContain("cada facultad");
    expect(r.nota).toContain("53%");
  });

  it("si todas coinciden, el chip vuelve a ser exacto tal cual", () => {
    const r = resumenTasaEfectividad([{ tau: 0.53 }, { tau: 0.53 }], 0.53);
    expect(r.valor).toBe("53%");
    expect(r.nota).toContain("valor de referencia heredado");
  });

  it("sin reparto todavía, o con uno solo, se anuncia la global", () => {
    expect(resumenTasaEfectividad(null, 0.53).valor).toBe("53%");
    expect(resumenTasaEfectividad([], 0.7).valor).toBe("70%");
    expect(resumenTasaEfectividad([{ tau: 0.61 }], 0.53).valor).toBe("53%");
  });

  it("una diferencia que se redondea a lo mismo no se anuncia como rango", () => {
    // 0,529 y 0,531 son ambos «53%»: «53%–53%» sería ruido, no información.
    const r = resumenTasaEfectividad([{ tau: 0.529 }, { tau: 0.531 }], 0.53);
    expect(r.valor).toBe("53%");
  });

  it("ignora taus imposibles en vez de arrastrarlos al rango", () => {
    const r = resumenTasaEfectividad(
      [{ tau: 0.4 }, { tau: 0 }, { tau: -1 }, { tau: "x" }, { tau: null }, { tau: 0.8 }],
      0.53,
    );
    expect(r.valor).toBe("40%–80%");
  });
});
