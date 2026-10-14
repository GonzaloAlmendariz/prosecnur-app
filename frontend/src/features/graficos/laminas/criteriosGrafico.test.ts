// I2 (catálogo del recetario): los criterios del mapa de calor por criterio se leen en las dos formas que acepta el
// registro y se guardan sin criterios vacíos ni preguntas repetidas.
import { describe, expect, it } from "vitest";
import { escribirCriterios, leerCriterios } from "./CriteriosGrafico";

describe("criterios del mapa de calor por criterio", () => {
  it("lee la lista y el objeto por nombre", () => {
    expect(leerCriterios([{ id: "tec", titulo: "Técnicas", vars: ["r100_comp_1", "r100_comp_2"] }]))
      .toEqual([{ id: "tec", titulo: "Técnicas", vars: ["r100_comp_1", "r100_comp_2"] }]);
    expect(leerCriterios({ Blandas: { vars: "p3" } })).toEqual([{ id: "blandas", titulo: "Blandas", vars: ["p3"] }]);
    expect(leerCriterios(null)).toEqual([]);
  });

  it("guarda sin vacíos ni repetidas, y null si no queda ninguno", () => {
    expect(escribirCriterios([{ id: "", titulo: "Gestión académica", vars: ["p1", "p1", ""] }, { id: "x", titulo: " ", vars: [] }]))
      .toEqual([{ id: "gestion_academica", titulo: "Gestión académica", vars: ["p1"] }]);
    expect(escribirCriterios([])).toBeNull();
  });
});
