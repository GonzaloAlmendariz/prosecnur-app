import { describe, expect, it } from "vitest";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirEquipo } from "./equipoModel";

const CONSULTAS = {
  production_annulments: {
    responsibles: [
      { key: "p198_a", label: "P198 · Aplicador Uno", pulso_code: "P198", responses: 80, valid_responses: 74, umps: 9, districts: "ATE · SAN MARTIN DE PORRES", latest_activity: "2026-07-02", status: "activo" },
      { key: "p702_b", label: "P702 · Aplicador Dos", pulso_code: "P702", responses: 311, valid_responses: 88, umps: 13, districts: "LOS OLIVOS", latest_activity: "2026-06-20", status: "anulado" },
    ],
  },
  internal_queries: {
    review_cases: [
      { id: "1", type: "gps", pulso_code: "P198", ump: "UMP 145" },
      { id: "2", type: "gps", pulso_code: "p198", ump: "145" },
      { id: "3", type: "duration", pulso_code: "P198", ump: "UMP 12" },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;

const VALIDACION = {
  response_audit: [
    { pulso_code: "P198", geo_estado: "geo_ok", duration_seconds: 800, submission_date_iso: "2026-06-16", advance_valid: true },
    { pulso_code: "P198", geo_estado: "geo_no_defendible", duration_seconds: 200, submission_date_iso: "2026-06-16", advance_valid: true },
    { pulso_code: "P198", geo_estado: "geo_sin_gps", duration_seconds: 90, submission_date_iso: "2026-06-17", advance_valid: false },
    { pulso_code: "P900", geo_estado: "geo_ok", duration_seconds: 700, submission_date_iso: "2026-06-18", advance_valid: true },
  ],
} as unknown as MonitoreoTerritorialDashboard;

describe("Control › Equipo", () => {
  const modelo = construirEquipo(CONSULTAS, VALIDACION);
  const p198 = modelo.filas.find((fila) => fila.codigo === "P198")!;

  it("una fila por código, los activos primero y con su base de anulaciones", () => {
    expect(modelo.filas.map((fila) => [fila.codigo, fila.anulado])).toEqual([["P198", false], ["P702", true]]);
    expect(p198).toMatchObject({ aplicador: "P198 · Aplicador Uno", recibidas: 80, cuentan: 74, umps: 9, distritos: ["Ate", "San Martín de Porres"], ultimo: "02/07" });
  });

  it("las señales del código salen de la auditoría con su base", () => {
    expect(p198.gpsObservado).toEqual({ casos: 1, base: 2, texto: "50 %" });
    expect(p198.cortas).toBe(2);
    expect(modelo.dias).toEqual(["2026-06-16", "2026-06-17", "2026-06-18"]);
    expect(p198.porDia).toEqual([2, 0, 0]);
  });

  it("lo que está en bandeja, por señal y por UMP", () => {
    expect(p198.enBandeja).toBe(3);
    expect(p198.senales).toEqual([{ tipo: "gps", rotulo: "GPS fuera de su manzana", casos: 2 }, { tipo: "duration", rotulo: "Duración corta", casos: 1 }]);
    expect(p198.umpsConSenal).toEqual([{ ump: "145", casos: 2 }, { ump: "12", casos: 1 }]);
  });

  it("sin auditoría ni bandeja, las señales quedan sin dato y no en cero", () => {
    const sin = construirEquipo({ production_annulments: CONSULTAS.production_annulments } as MonitoreoTerritorialDashboard, null);
    expect(sin.filas[0]).toMatchObject({ gpsObservado: null, cortas: null, porDia: null, enBandeja: null });
  });
});
