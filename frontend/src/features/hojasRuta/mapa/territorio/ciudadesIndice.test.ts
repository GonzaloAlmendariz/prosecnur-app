import { describe, expect, it } from "vitest";
import indice from "../../ciudadesIndice.json";

// Índice de ciudades del atlas de Territorio (paquete docs/qa/plan-territorio-por-regiones-2026-10-29.md, R1b).
type Ciudad = { codigo: string; nombre: string; departamento: string; regiones: string[]; ubigeos: string[]; centro: number[]; silueta: number[][][] };
const ciudades = (indice as { ciudades: Ciudad[] }).ciudades;

describe("índice de ciudades", () => {
  it("trae las 26 ciudades con cartografía, Lima y Callao como una sola", () => {
    expect(ciudades).toHaveLength(26);
    const lima = ciudades.find((c) => c.codigo === "lima");
    expect(lima?.regiones).toEqual(["15", "07"]);
    expect(lima?.ubigeos.some((u) => u.startsWith("0701"))).toBe(true);
  });
  it("cada ciudad dice qué región la carga y sus distritos son de ella", () => {
    for (const c of ciudades) {
      if (c.codigo === "lima") continue;
      expect(c.codigo).toMatch(/^\d{4}$/);
      expect(c.regiones).toEqual([c.codigo.slice(0, 2)]);
      expect(c.ubigeos.every((u) => u.startsWith(c.codigo))).toBe(true);
    }
  });
  it("cada ciudad tiene silueta y su centro cae en el Perú", () => {
    for (const c of ciudades) {
      expect(c.silueta.length).toBeGreaterThan(0);
      expect(c.silueta.every((r) => r.length >= 4)).toBe(true);
      const [lon, lat] = c.centro;
      expect(lon).toBeGreaterThan(-82);
      expect(lon).toBeLessThan(-68);
      expect(lat).toBeGreaterThan(-19);
      expect(lat).toBeLessThan(0.5);
    }
  });
});
