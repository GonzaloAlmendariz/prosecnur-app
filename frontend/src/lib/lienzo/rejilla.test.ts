import { describe, expect, it } from "vitest";

import { ajustarAGrilla, guiasCercanas, imantar, posicionLibre, type Caja } from "./rejilla";

describe("ajustarAGrilla", () => {
  it.each([
    [0, 0],
    [7, 0],
    [9, 16],
    [24, 32],
    [-7, -0],
  ])("%i => %i", (entrada, esperado) => {
    expect(ajustarAGrilla(entrada)).toBe(esperado);
  });

  it("una grilla de cero deja el valor intacto en vez de dividir por cero", () => {
    expect(ajustarAGrilla(37, 0)).toBe(37);
  });
});

describe("guiasCercanas", () => {
  const otras: Caja[] = [{ x: 100, y: 100, w: 200, h: 100 }];

  it("detecta alineación por borde izquierdo", () => {
    const g = guiasCercanas({ x: 102, y: 400, w: 50, h: 50 }, otras);
    expect(g).toContainEqual({ eje: "x", valor: 100 });
  });

  it("detecta alineación por centro", () => {
    // Alinear por el centro es lo que la gente hace a ojo.
    const g = guiasCercanas({ x: 175, y: 400, w: 50, h: 50 }, otras);
    expect(g.some((x) => x.eje === "x" && x.valor === 200)).toBe(true);
  });

  it("no reporta guías fuera de la tolerancia", () => {
    expect(guiasCercanas({ x: 500, y: 500, w: 50, h: 50 }, otras)).toEqual([]);
  });

  it("no repite la misma guía por dos cajas alineadas entre sí", () => {
    const dos: Caja[] = [
      { x: 100, y: 0, w: 50, h: 50 },
      { x: 100, y: 300, w: 50, h: 50 },
    ];
    const g = guiasCercanas({ x: 101, y: 150, w: 50, h: 50 }, dos);
    expect(g.filter((x) => x.eje === "x" && x.valor === 100)).toHaveLength(1);
  });
});

describe("imantar", () => {
  it("acerca la caja a la guía más próxima", () => {
    const { dx } = imantar({ x: 103, y: 0, w: 50, h: 50 }, [{ eje: "x", valor: 100 }]);
    expect(dx).toBe(-3);
  });

  it("elige la guía más cercana cuando hay varias", () => {
    // Saltar a una lejana se siente como un tirón.
    const { dx } = imantar({ x: 102, y: 0, w: 50, h: 50 }, [
      { eje: "x", valor: 100 },
      { eje: "x", valor: 140 },
    ]);
    expect(dx).toBe(-2);
  });

  it("sin guías no mueve nada", () => {
    expect(imantar({ x: 10, y: 10, w: 50, h: 50 }, [])).toEqual({ dx: 0, dy: 0 });
  });
});

describe("posicionLibre", () => {
  it("usa el ancla si está libre", () => {
    expect(posicionLibre({ x: 0, y: 0 }, { w: 100, h: 50 }, [])).toEqual({ x: 0, y: 0 });
  });

  it("se corre cuando el ancla está ocupada", () => {
    // Crear tres nodos seguidos tiene que dejarlos visibles, no superpuestos.
    const out = posicionLibre({ x: 0, y: 0 }, { w: 100, h: 50 }, [{ x: 0, y: 0, w: 100, h: 50 }]);
    expect(out).not.toEqual({ x: 0, y: 0 });
  });

  it("encuentra hueco entre varios ocupados", () => {
    const ocupadas: Caja[] = [
      { x: 0, y: 0, w: 100, h: 50 },
      { x: 24, y: 0, w: 100, h: 50 },
      { x: 0, y: 24, w: 100, h: 50 },
    ];
    const out = posicionLibre({ x: 0, y: 0 }, { w: 100, h: 50 }, ocupadas);
    const choca = ocupadas.some(
      (c) => out.x < c.x + c.w && out.x + 100 > c.x && out.y < c.y + c.h && out.y + 50 > c.y,
    );
    expect(choca).toBe(false);
  });
});
