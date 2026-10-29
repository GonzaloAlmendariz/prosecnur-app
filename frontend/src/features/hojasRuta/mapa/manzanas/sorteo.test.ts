import { describe, expect, it } from "vitest";
import type { HojasRutaIntegratedConfig, HojasRutaRouteSnapshot, HojasRutaSamplePreview } from "../../../../api/hojasRuta";
import { acotarReemplazos, aplicarSorteo, cambiosDeSorteo, conInstantanea, instantaneaDeSorteo, MAX_HISTORIAL, mismoTerritorio, otraSemilla, parametrosDeSorteo, saltoVistaPrevia } from "./sorteo";

const config = {
  sampling_method: "pps",
  measure_var: "viviendas",
  seed: 2017,
  route_start_corner: "auto",
  route_jump_mode: "auto",
  route_jump_manual: 1,
  replacements_per_titular: 1,
  replacement_policy: "alternate_zone_same_district",
  entrevistas_por_manzana: 8,
  n_objetivo: 16,
  territorios: ["150103", "150108"],
} as unknown as HojasRutaIntegratedConfig;

const bloque = (ubigeo: string, distrito: string, entrevistas: number) => ({ ubigeo, distrito, entrevistas }) as unknown as HojasRutaSamplePreview["blocks"][number];
const sample = {
  method: "pps",
  seed: 2017,
  blocks: [bloque("150103", "ATE", 8), bloque("150103", "ATE", 8), bloque("150108", "CHORRILLOS", 8)],
  replacement_blocks: [bloque("150108", "CHORRILLOS", 0)],
  n_blocks: 3,
  n_replacement_blocks: 1,
  total_entrevistas: 24,
  total_replacement_interviews: 8,
} as unknown as HojasRutaSamplePreview;

describe("borrador del sorteo", () => {
  it("sin borrador la configuración no cambia y no hay cambios", () => {
    expect(aplicarSorteo(config, null)).toBe(config);
    expect(cambiosDeSorteo(config, null)).toEqual([]);
  });

  it("sólo cuenta como cambio lo que difiere de lo guardado", () => {
    const b = { seed: 2017, sampling_method: "sistematico" as const, replacements_per_titular: 3 };
    expect(cambiosDeSorteo(config, b)).toEqual(["sampling_method", "replacements_per_titular"]);
    expect(aplicarSorteo(config, b).sampling_method).toBe("sistematico");
  });

  it("los reemplazos quedan entre 0 y 10 enteros", () => {
    expect(acotarReemplazos(-2)).toBe(0);
    expect(acotarReemplazos(2.6)).toBe(3);
    expect(acotarReemplazos(40)).toBe(10);
    expect(acotarReemplazos(Number.NaN)).toBe(1);
  });
});

describe("semilla y salto", () => {
  it("«Otra» da cinco cifras y nunca repite la actual", () => {
    expect(otraSemilla(1, 0)).toBe(10000);
    expect(otraSemilla(10000, 0)).toBe(10001);
    expect(otraSemilla(99999, 0.99999999)).toBe(10000);
  });

  it("K = viviendas por manzana / entrevistas, y el operativo es floor(K) con mínimo 1", () => {
    expect(saltoVistaPrevia(4000, 100, 8)).toEqual({ k: 5, operativo: 5 });
    expect(saltoVistaPrevia(500, 100, 8)?.operativo).toBe(1);
    expect(saltoVistaPrevia(0, 100, 8)).toBeNull();
  });
});

describe("historial de ruteos", () => {
  it("la instantánea resume por distrito titulares, entrevistas y reemplazos", () => {
    const s = instantaneaDeSorteo(sample, config, new Date("2026-10-29T15:04:00Z"), "r1");
    expect(s.n_blocks).toBe(3);
    expect(s.distribution).toEqual([
      { ubigeo: "150103", distrito: "ATE", n: 16, manzanas: 2, reemplazos: 0 },
      { ubigeo: "150108", distrito: "CHORRILLOS", n: 8, manzanas: 1, reemplazos: 1 },
    ]);
    expect(s.label).toContain("N 24 · 3 manzanas");
  });

  it("el historial no duplica el mismo sorteo y respeta el tope", () => {
    const s = (id: string, seed: number) => ({ ...instantaneaDeSorteo(sample, config, new Date(0), id), seed }) as HojasRutaRouteSnapshot;
    const viejos = Array.from({ length: 10 }, (_, i) => s(`v${i}`, i));
    const nuevo = conInstantanea(viejos, s("n", 3));
    expect(nuevo[0].id).toBe("n");
    expect(nuevo.filter((h) => h.seed === 3)).toHaveLength(1);
    expect(nuevo).toHaveLength(MAX_HISTORIAL);
  });
});

describe("volver a un ruteo", () => {
  it("toma sólo los parámetros del sorteo, nunca el N ni el territorio viejos", () => {
    const vieja = { ...config, seed: 99, sampling_method: "sistematico", n_objetivo: 30, territorios: ["150101"] } as unknown as HojasRutaIntegratedConfig;
    const p = parametrosDeSorteo(vieja);
    expect(p).toMatchObject({ seed: 99, sampling_method: "sistematico" });
    expect(p).not.toHaveProperty("n_objetivo");
    expect(p).not.toHaveProperty("territorios");
    expect(aplicarSorteo(config, p).n_objetivo).toBe(16);
  });

  it("sólo se repite con el mismo territorio, en cualquier orden", () => {
    expect(mismoTerritorio(["a", "b"], ["b", "a"])).toBe(true);
    expect(mismoTerritorio(["a"], ["a", "b"])).toBe(false);
  });
});
