import { describe, expect, test } from "vitest";
import cobertura from "../../limaDistrictCoverage.json";
import { proyectarLonLat } from "./camara";
import { contornosDeCobertura, elegirRotulos, mezclar } from "./capas";

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
