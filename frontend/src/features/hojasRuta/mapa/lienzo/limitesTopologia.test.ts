import { describe, expect, it } from "vitest";
import nacional from "../../peruDepartamentos.json";
import fino from "../../peruDepartamentosDetalle.json";

type Nivel = { departamentos: Array<{ codigo: string; nombre: string; anillos: number[][][] }> };

/**
 * Dos departamentos vecinos dibujan su frontera con la misma línea (revisión de UI, 7 nov 2026: el contorno
 * de Ayacucho no calzaba con el de sus vecinos porque cada departamento se simplificaba por su cuenta).
 * Con topología compartida, un vértice de A pegado a la frontera de B es también vértice de B.
 */
function vecinosQueNoCalzan(nivel: Nivel, tolerancia: number): string[] {
  const CELDA = 0.05;
  const celda = (x: number, y: number) => `${Math.floor(x / CELDA)},${Math.floor(y / CELDA)}`;
  const deps = nivel.departamentos.map((d) => {
    const vertices = new Set<string>();
    const segmentos = new Map<string, Array<[number, number, number, number]>>();
    for (const r of d.anillos) {
      for (let i = 0; i < r.length; i++) {
        const [x1, y1] = r[i];
        const [x2, y2] = r[(i + 1) % r.length];
        vertices.add(`${x1},${y1}`);
        const cx0 = Math.floor((Math.min(x1, x2) - tolerancia) / CELDA), cx1 = Math.floor((Math.max(x1, x2) + tolerancia) / CELDA);
        const cy0 = Math.floor((Math.min(y1, y2) - tolerancia) / CELDA), cy1 = Math.floor((Math.max(y1, y2) + tolerancia) / CELDA);
        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++) {
            const k = `${cx},${cy}`;
            const lista = segmentos.get(k) ?? [];
            lista.push([x1, y1, x2, y2]);
            segmentos.set(k, lista);
          }
      }
    }
    return { nombre: d.nombre, anillos: d.anillos, vertices, segmentos };
  });
  const distancia = (px: number, py: number, [x1, y1, x2, y2]: [number, number, number, number]) => {
    const dx = x2 - x1, dy = y2 - y1;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };
  // Un vértice de A que no es de B pero cae pegado a la línea de B (sin estar sobre ella).
  const descalzado = (b: (typeof deps)[number], x: number, y: number) => {
    if (b.vertices.has(`${x},${y}`)) return false;
    const cercanos = b.segmentos.get(celda(x, y)) ?? [];
    return cercanos.some((s) => distancia(x, y, s) < tolerancia) && !cercanos.some((s) => distancia(x, y, s) < 1e-6);
  };
  // El defecto es un TRAMO paralelo: dos vértices seguidos de A descalzados de B. Uno solo, junto al punto
  // donde se juntan tres departamentos, es la frontera con el tercero que arranca ahí.
  const malos = new Set<string>();
  for (const a of deps)
    for (const b of deps) {
      if (a === b) continue;
      for (const r of a.anillos)
        for (let i = 0; i < r.length; i++) {
          const [x1, y1] = r[i];
          const [x2, y2] = r[(i + 1) % r.length];
          if (descalzado(b, x1, y1) && descalzado(b, x2, y2)) malos.add(`${a.nombre}↔${b.nombre}`);
        }
    }
  return [...malos];
}

describe("límites del Perú: la frontera entre departamentos es una sola línea", () => {
  // La tolerancia es del orden del intervalo de simplificación de cada nivel (3 km y 400 m): el descalce de
  // antes era de ese orden.
  it.each([
    ["nacional", nacional as Nivel, 0.01],
    ["fino", fino as Nivel, 0.004],
  ])("nivel %s", (_, nivel, tolerancia) => {
    expect(nivel.departamentos).toHaveLength(25);
    // El lago Junín (Chinchaycocha) no es de ningún departamento: las orillas de Pasco y Junín son dos líneas
    // de verdad, a unos 150 m en su punta norte.
    const AGUA = new Set(["Pasco↔Junín", "Junín↔Pasco"]);
    expect(vecinosQueNoCalzan(nivel, tolerancia).filter((par) => !AGUA.has(par))).toEqual([]);
  });

  it("el nivel nacional sigue cabiendo en el bundle", () => {
    expect(JSON.stringify(nacional).length).toBeLessThan(60 * 1024);
  });
});
