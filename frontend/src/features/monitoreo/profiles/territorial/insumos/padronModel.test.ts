import { describe, expect, it } from "vitest";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { construirPadron } from "./padronModel";

const STATE = {
  config: {
    territorial: {
      enumerator_roster: {
        file_name: "Lista de encuestadores.XLS", total: 3, code_format: "PXXX", uploaded_at: "2026-06-12T22:59:00Z",
        assignments: [
          { codigo_pulso: "P702", nombre: "Aplicador Dos", dni: "00000000" },
          { codigo_pulso: "p198", nombre: "Aplicador Uno", dni: "11111111" },
          { codigo_pulso: "P300", nombre: "Aplicador Tres" },
        ],
      },
    },
  },
} as unknown as MonitoreoState;

const REPORTS = {
  production_annulments: {
    responsibles: [
      { key: "a", label: "P198 · Aplicador Uno", pulso_code: "P198", responses: 80, umps: 9, latest_activity: "2026-07-02", status: "activo" },
      { key: "b", label: "P702 · Aplicador Dos", pulso_code: "P702", responses: 311, umps: 13, latest_activity: "2026-06-20", status: "anulado" },
      { key: "c", label: "109", pulso_code: "109", responses: 4, umps: 1, status: "activo" },
      { key: "d", label: "P4461", pulso_code: "P4461", responses: 2, umps: 1, status: "activo" },
    ],
  },
} as unknown as MonitoreoTerritorialDashboard;

describe("Insumos › Padrón", () => {
  const modelo = construirPadron(STATE, REPORTS);

  it("el archivo del padrón con su base y la hora en Lima", () => {
    expect(modelo.archivo).toEqual({ nombre: "Lista de encuestadores.XLS", personas: 3, formato: "PXXX", subido: "12/06 17:59" });
  });

  it("cada persona con sus casos y su estado, en orden de código y sin DNI", () => {
    expect(modelo.filas).toEqual([
      { codigo: "P198", nombre: "Aplicador Uno", casos: 80, umps: 9, ultimo: "02/07", estado: "con-casos" },
      { codigo: "P300", nombre: "Aplicador Tres", casos: 0, umps: 0, ultimo: "", estado: "sin-casos" },
      { codigo: "P702", nombre: "Aplicador Dos", casos: 311, umps: 13, ultimo: "20/06", estado: "anulado" },
    ]);
    expect(JSON.stringify(modelo)).not.toContain("00000000");
  });

  it("los códigos de la base que no están en el padrón", () => {
    expect(modelo.fueraDelPadron).toEqual([{ codigo: "109", casos: 4 }, { codigo: "P4461", casos: 2 }]);
  });

  it("sin padrón no hay tabla, pero los códigos de la base siguen listados", () => {
    const sin = construirPadron(null, REPORTS);
    expect(sin.disponible).toBe(false);
    expect(sin.fueraDelPadron).toHaveLength(4);
  });
});
