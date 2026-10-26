import { describe, expect, it } from "vitest";
import {
  DOCK_GEOMETRIA_POR_DEFECTO,
  anchoNaturalDock,
  repartirDock,
} from "./moduleDockModel";

const OCHO = [
  "/bitacora",
  "/calc-muestra",
  "/editor-xlsform",
  "/hojas-ruta",
  "/material-campo",
  "/monitoreo",
  "/procesamiento",
  "/tablero",
].map((to) => ({ to }));

describe("repartirDock (L35)", () => {
  it("sin medida no recoge nada", () => {
    const r = repartirDock(OCHO, "/procesamiento", null);
    expect(r.visibles).toHaveLength(8);
    expect(r.ocultos).toHaveLength(0);
  });

  it("ocho módulos + Agregar caben sin tope en el cupo de 1440 y de 1024", () => {
    // 8 px de marco + 7 compactos × 39 + activo con nombre + «Agregar».
    const natural = anchoNaturalDock(7, true);
    expect(natural).toBe(8 + 7 * 39 + DOCK_GEOMETRIA_POR_DEFECTO.anchoActivo + 39);
    // El tope viejo era min(328px, 32vw): el dock natural lo supera.
    expect(natural).toBeGreaterThan(328);
    for (const cupo of [natural, 1000, 700]) {
      const r = repartirDock(OCHO, "/procesamiento", cupo);
      expect(r.ocultos).toEqual([]);
      expect(r.visibles.map((i) => i.to)).toEqual(OCHO.map((i) => i.to));
    }
  });

  it("cuando no alcanza, recoge al final y conserva el activo aunque sea el último", () => {
    const r = repartirDock(OCHO, "/tablero", 300);
    const fijo = 8 + DOCK_GEOMETRIA_POR_DEFECTO.anchoActivo + 39 + 39;
    const caben = Math.floor((300 - fijo) / 39);
    expect(r.visibles.map((i) => i.to)).toEqual([...OCHO.slice(0, caben).map((i) => i.to), "/tablero"]);
    expect(r.ocultos.map((i) => i.to)).toEqual(OCHO.slice(caben, 7).map((i) => i.to));
    // Nada se pierde: visibles ∪ ocultos = los ocho, sin duplicados.
    expect(new Set([...r.visibles, ...r.ocultos].map((i) => i.to)).size).toBe(8);
  });

  it("el reparto recogido nunca pide más que el cupo", () => {
    for (let cupo = 120; cupo < 460; cupo += 7) {
      const r = repartirDock(OCHO, "/monitoreo", cupo);
      if (r.ocultos.length === 0) continue;
      const usado = 8 + (r.visibles.length - 1) * 39 + DOCK_GEOMETRIA_POR_DEFECTO.anchoActivo + 39 + 39;
      const minimo = 8 + DOCK_GEOMETRIA_POR_DEFECTO.anchoActivo + 39 + 39;
      expect(usado <= cupo || r.visibles.length === 1 && usado === minimo).toBe(true);
      expect(r.visibles.some((i) => i.to === "/monitoreo")).toBe(true);
    }
  });
});
