import { describe, expect, test } from "vitest";
import cobertura from "../../limaDistrictCoverage.json";
import { proyectarLonLat } from "./camara";
import { contornosDeCobertura, elegirRotulos, mezclar, rotulosAlCostado, sinPisarFichas } from "./capas";

describe("proyección lon/lat", () => {
  test("coincide con la de R (.hojas_ruta_geometria_proyectar)", () => {
    // En R: round((lon − (−76,99))·111320·cos(−12,03°)) y round(−(lat − (−12,03))·110540)
    expect(proyectarLonLat(-76.99, -12.03)).toEqual([0, 0]);
    expect(proyectarLonLat(-76.98, -12.04)).toEqual([1089, 1105]);
    expect(proyectarLonLat(-77.0, -12.0)).toEqual([-1089, -3316]);
  });
});

describe("contornos de Lima y Callao", () => {
  const contornos = contornosDeCobertura(cobertura as Parameters<typeof contornosDeCobertura>[0]);

  test("los 50 distritos traen contorno, caja y punto de rótulo", () => {
    expect(contornos).toHaveLength(50);
    for (const c of contornos) {
      expect(c.ubigeo).toMatch(/^(1501|0701)\d{2}$/);
      expect(c.anillos.every((r) => r.length >= 6)).toBe(true);
      expect(c.caja[2]).toBeGreaterThan(c.caja[0]);
    }
  });

  test("Ate queda al este del origen y San Juan de Lurigancho al norte de Ate", () => {
    const ate = contornos.find((c) => c.ubigeo === "150103");
    const sjl = contornos.find((c) => c.ubigeo === "150132");
    expect(ate && sjl).toBeTruthy();
    if (!ate || !sjl) return;
    expect(ate.rotulo[0]).toBeGreaterThan(0);
    // y crece hacia el sur: más al norte = y menor
    expect(sjl.rotulo[1]).toBeLessThan(ate.rotulo[1]);
  });
});

describe("rótulos sin pisarse", () => {
  test("el primero gana y el que choca se descarta sin moverse", () => {
    const elegidos = elegirRotulos([
      { clave: "a", x: 100, y: 100, w: 80, h: 20 },
      { clave: "b", x: 140, y: 105, w: 80, h: 20 },
      { clave: "c", x: 100, y: 140, w: 80, h: 20 },
      { clave: "d", x: 400, y: 100, w: 80, h: 20 },
    ]);
    expect(elegidos.map((e) => e.clave)).toEqual(["a", "c", "d"]);
    expect(elegidos[1]).toMatchObject({ x: 100, y: 140 });
  });

  test("el margen separa rótulos que sólo se rozan", () => {
    const juntos = [
      { clave: "a", x: 0, y: 0, w: 100, h: 20 },
      { clave: "b", x: 102, y: 0, w: 100, h: 20 },
    ];
    expect(elegirRotulos(juntos, 0).map((e) => e.clave)).toEqual(["a", "b"]);
    expect(elegirRotulos(juntos, 4).map((e) => e.clave)).toEqual(["a"]);
  });
});


describe("identidad por distrito y rótulos sin pérdidas (B9, B10)", () => {
  test("mezclar va de un color al otro y deja intacto lo que no es hex", () => {
    expect(mezclar("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mezclar("#e6eaf0", "#7aa2f8", 0)).toBe("#e6eaf0");
    expect(mezclar("rgb(1,2,3)", "#ffffff", 0.5)).toBe("rgb(1,2,3)");
  });
  test("con desplazamiento ningún rótulo se pierde y no se pisan", () => {
    const juntos = [0, 1, 2, 3, 4, 5].map((i) => ({ clave: String(i), x: 100, y: 100 + i * 3, w: 120, h: 38 }));
    const puestos = elegirRotulos(juntos, 4, true);
    expect(puestos.map((p) => p.clave)).toEqual(["0", "1", "2", "3", "4", "5"]);
    for (const a of puestos) for (const b of puestos) {
      if (a === b) continue;
      expect(Math.abs(a.y + a.dy - (b.y + b.dy)) >= 38).toBe(true);
    }
    expect(elegirRotulos(juntos, 4).length).toBe(1);
    // Corridos, nunca suben bajo la miga ni bajan sobre el pie.
    const arriba = elegirRotulos([{ clave: "a", x: 0, y: 60, w: 100, h: 38 }, { clave: "b", x: 0, y: 62, w: 100, h: 38 }], 4, true, { arriba: 52, abajo: 400 });
    expect(arriba.find((p) => p.clave === "b")!.dy).toBeGreaterThan(0);
  });
});

import { tonoCss, tonoGenerado } from "./tonos";

describe("tonos de distrito sin repetir (pedido de Gonzalo: 20 distritos)", () => {
  test("los 8 primeros son tokens y del noveno en adelante se generan distintos", () => {
    const veinte = Array.from({ length: 20 }, (_, i) => tonoCss(i));
    expect(veinte.slice(0, 8).every((t) => t.startsWith("var(--pulso-mapa-tono-"))).toBe(true);
    expect(new Set(veinte).size).toBe(20);
    expect(tonoGenerado(8)).toMatch(/^hsl\(/);
  });
});

describe("fichas al costado del lienzo (revisión del mapa, 2 nov 2026)", () => {
  const limites = { arriba: 52, abajo: 548 };
  test("con los distritos repartidos por el lienzo (Muestra encuadrada), se quedan en su sitio aunque choquen", () => {
    const repartidos = [{ clave: "a", x: 250, y: 200, w: 160, h: 38 }, { clave: "b", x: 300, y: 215, w: 160, h: 38 }, { clave: "c", x: 600, y: 450, w: 160, h: 38 }];
    expect(rotulosAlCostado(repartidos, 800, limites)).toBeNull();
  });
  test("si ninguna choca en su sitio, no se mueven", () => {
    expect(rotulosAlCostado([{ clave: "a", x: 100, y: 100, w: 120, h: 38 }, { clave: "b", x: 500, y: 400, w: 120, h: 38 }], 800, limites)).toBeNull();
  });
  test("apiñadas, van al lado más cercano, ordenadas por altura, dentro de los límites y sin pisarse", () => {
    const juntos = [0, 1, 2, 3, 4, 5].map((i) => ({ clave: String(i), x: 380 + (i % 2) * 60, y: 280 + i * 8, w: 140, h: 38 }));
    const r = rotulosAlCostado(juntos, 800, limites);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r).toHaveLength(6);
    for (const f of r) {
      expect(f.lado === "izq" ? f.x < 400 : f.x >= 400).toBe(true);
      expect(f.cy - f.h / 2).toBeGreaterThanOrEqual(limites.arriba);
      expect(f.cy + f.h / 2).toBeLessThanOrEqual(limites.abajo);
      expect(f.lado === "izq" ? f.cx - f.w / 2 : 800 - (f.cx + f.w / 2)).toBe(14);
    }
    for (const lado of ["izq", "der"] as const) {
      const col = r.filter((f) => f.lado === lado);
      // El orden de la columna sigue el de los distritos: las guías no se cruzan.
      expect(col.map((f) => f.y)).toEqual([...col.map((f) => f.y)].sort((a, b) => a - b));
      for (let i = 1; i < col.length; i++) expect(col[i].cy - col[i - 1].cy).toBeGreaterThanOrEqual(38 + 6);
    }
  });
  test("una columna llena cede al otro lado; si tampoco caben, el llamador sigue como antes", () => {
    const izquierda = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ clave: String(i), x: 300, y: 300, w: 140, h: 60 }));
    const r = rotulosAlCostado(izquierda, 800, limites);
    expect(r?.some((f) => f.lado === "der")).toBe(true);
    const demasiadas = Array.from({ length: 20 }, (_, i) => ({ clave: String(i), x: 400, y: 300, w: 140, h: 60 }));
    expect(rotulosAlCostado(demasiadas, 800, limites)).toBeNull();
  });
  test("ninguna ficha tapa su distrito: en un lienzo angosto sin lado libre, sigue el reparto de siempre", () => {
    // 380 px de ancho: una ficha de 140 a cualquier lado cae encima de distritos que están en el centro.
    const angosto = [0, 1, 2].map((i) => ({ clave: String(i), x: 150 + i * 20, y: 300, w: 140, h: 38 }));
    expect(rotulosAlCostado(angosto, 380, limites)).toBeNull();
    // Con espacio, la que está al oeste va a la izquierda sin taparse.
    const r = rotulosAlCostado([{ clave: "o", x: 300, y: 300, w: 140, h: 38 }, { clave: "e", x: 320, y: 305, w: 140, h: 38 }], 800, limites);
    for (const f of r ?? []) expect(f.lado === "izq" ? f.cx + f.w / 2 < f.x : f.cx - f.w / 2 > f.x).toBe(true);
  });
});

describe("sinPisarFichas (D11, checklist visual 2/11)", () => {
  test("quita el nombre que caería bajo una ficha y deja los que están lejos", () => {
    const ficha = { x: 100, y: 100, w: 80, h: 38 };
    const nombres = [
      { clave: "callao", x: 110, y: 105, w: 40, h: 14 },
      { clave: "bellavista", x: 100, y: 125, w: 60, h: 14 },
      { clave: "lejos", x: 300, y: 300, w: 40, h: 14 },
    ];
    expect(sinPisarFichas(nombres, [ficha]).map((n) => n.clave)).toEqual(["lejos"]);
    expect(sinPisarFichas(nombres, [])).toHaveLength(3);
  });
});
