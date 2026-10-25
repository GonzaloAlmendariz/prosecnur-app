import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirReportes, textoDeDiferencia } from "./reportesModel";

const OCURRENCIAS = {
  route_quota_progress: {
    blocks: [
      { id_manzana: "m1", distrito: "ATE" },
      { id_manzana: "m2", distrito: "ATE" },
      { id_manzana: "m3", distrito: "SAN MARTIN DE PORRES" },
    ],
    ump_groups: [
      { ump: "2", selected_id_manzana: "m2" },
      { ump: "1", selected_id_manzana: "m1" },
      { ump: "3", selected_id_manzana: "m3" },
    ],
  },
  field_occurrences: {
    by_ump: [
      { ump: "UMP 1", reportes: 1, efectivas: 8, intentos: 20 },
      { ump: "2", reportes: 2, efectivas: 49, intentos: 115 },
      { ump: "1437", reportes: 1, efectivas: 3, intentos: 9 },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;

const VALIDACION = {
  response_audit: [
    ...Array.from({ length: 8 }, () => ({ advance_block_ump: "UMP 1" })),
    ...Array.from({ length: 9 }, () => ({ advance_block_ump: "2" })),
  ],
} as unknown as MonitoreoTerritorialDashboard;

describe("Control › Reportes UMP", () => {
  const modelo = construirReportes(OCURRENCIAS, VALIDACION);

  it("una baldosa por UMP de la ruta, agrupadas por distrito y en orden", () => {
    expect(modelo.distritos.map((bloque) => [bloque.distrito, bloque.baldosas.map((b) => b.ump)])).toEqual([
      ["Ate", ["1", "2"]],
      ["San Martín de Porres", ["3"]],
    ]);
  });

  it("partes, sin parte y si lo declarado cuadra con lo recibido", () => {
    expect([modelo.conUnParte, modelo.conDosOMas, modelo.sinParte]).toEqual([1, 1, ["3"]]);
    const ump2 = modelo.distritos[0].baldosas[1];
    expect(ump2).toMatchObject({ partes: 2, efectivasDeclaradas: 49, recibidas: 9, diferencia: 40, intentos: 115 });
    expect(textoDeDiferencia(ump2.diferencia)).toBe("No cuadra: el parte declara 40 más de lo recibido");
    expect(textoDeDiferencia(modelo.distritos[0].baldosas[0].diferencia)).toBe("Cuadra");
    expect(modelo.noCuadran).toEqual({ total: 1, conMenos: 0, conMas: 1 });
  });

  it("avisa los partes de UMP que no están en la ruta", () => {
    expect(modelo.fueraDeRuta).toEqual(["1437"]);
  });

  it("sin el corte de Validación no compara, y lo dice", () => {
    const sin = construirReportes(OCURRENCIAS, null);
    expect(sin.noCuadran).toBeNull();
    expect(sin.distritos[0].baldosas[1].diferencia).toBeNull();
    expect(textoDeDiferencia(null)).toBe("Sin recibidas para comparar");
  });

  it("toma la ruta del corte que la trae aunque el de consultas venga vacío", () => {
    const consultasVacio = { ...OCURRENCIAS, route_quota_progress: { blocks: [], ump_groups: [] } } as unknown as MonitoreoTerritorialDashboard;
    const conRuta = { ...VALIDACION, route_quota_progress: OCURRENCIAS.route_quota_progress } as unknown as MonitoreoTerritorialDashboard;
    expect(construirReportes(consultasVacio, conRuta).distritos.flatMap((bloque) => bloque.baldosas.map((b) => b.ump))).toEqual(["1", "2", "3"]);
  });
});
