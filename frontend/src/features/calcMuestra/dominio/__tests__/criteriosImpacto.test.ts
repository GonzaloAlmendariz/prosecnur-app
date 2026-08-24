/**
 * Candado de las lecturas puras de criterios: la normalización de claves de
 * texto (que debe casar con `.cm_aulas_text_key` del motor R) y la unidad de
 * conteo de un criterio según su scope.
 *
 * `aulasSupervivientesFacultad`, el tercer export del módulo, tiene su propio
 * candado en `universidad/criterios/aulasFinalesModel.test.ts`, junto al modelo
 * que la consume.
 */
import { describe, expect, it } from "vitest";
import { textKey, unidadCriterio } from "../criteriosImpacto";

describe("textKey", () => {
  it("normaliza acentos, comillas y no-alfanumérico", () => {
    expect(textKey("Ingeniería")).toBe("ingenieria");
    expect(textKey("DOCENTE ORDINARIO - PRINCIPAL")).toBe("docente_ordinario_principal");
    expect(textKey("  A Distancia ")).toBe("a_distancia");
  });
});

describe("unidadCriterio", () => {
  it("estudiantes para alumno y cursos-horario para la unidad agrupada", () => {
    expect(unidadCriterio({ scope: "alumno" })).toBe("estudiantes");
    expect(unidadCriterio({ scope: "aula" })).toBe("cursos-horario");
  });
});
