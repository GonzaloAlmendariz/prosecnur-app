import { describe, expect, test } from "vitest";
import cobertura from "../../limaDistrictCoverage.json";
import { proyectarLonLat } from "./camara";
import { contornosDeCobertura, elegirRotulos } from "./capas";

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
