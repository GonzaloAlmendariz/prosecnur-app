import { describe, expect, it } from "vitest";

import { loQueAdoptaCalculo } from "./usePlannerIdentidad";

// La Ficha del estudio declara el nombre (ADR 0124). Cálculo de muestra guardaba su propio título
// editable y la misma entidad tenía dos lecturas: «Sin declarar» en la Ficha, «Encuesta a
// estudiantes» en Cálculo › Estudio (auditoría visual del 4 nov 2026).
describe("Cálculo adopta la identidad de la Ficha del estudio", () => {
  it("el nombre y el cliente de la Ficha mandan sobre la copia de Cálculo", () => {
    expect(loQueAdoptaCalculo(
      { nombre: "HSVG 2026", cliente: "UNSA" },
      { titulo: "Encuesta a estudiantes", cliente: "" },
    )).toEqual({ titulo: "HSVG 2026", cliente: "UNSA" });
  });

  it("si ya coinciden no hay nada que escribir (no ensucia el proyecto)", () => {
    expect(loQueAdoptaCalculo({ nombre: "HSVG 2026", cliente: "UNSA" }, { titulo: "HSVG 2026", cliente: "UNSA" })).toBeNull();
  });

  it("un campo vacío en la Ficha no borra lo que Cálculo ya tenía", () => {
    expect(loQueAdoptaCalculo({ nombre: "  ", cliente: "" }, { titulo: "Encuesta a estudiantes", cliente: "PUCP" })).toBeNull();
    expect(loQueAdoptaCalculo({ nombre: "Acogida 2026", cliente: "" }, { titulo: "x", cliente: "ACNUR" })).toEqual({ titulo: "Acogida 2026" });
  });

  it("sin Ficha leída no se toca nada", () => {
    expect(loQueAdoptaCalculo(null, { titulo: "x", cliente: "y" })).toBeNull();
  });
});
