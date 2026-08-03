import { describe, expect, it } from "vitest";

import { unidadEjeDeCriterio, varianteDeCriterio } from "../varianteCriterio";

/**
 * G22 · Gonzalo: «no veo en la app los cuatro tipos de tarjeta para los cuatro
 * tipos de criterios que manejamos». Las cuatro variantes existían con sus
 * guards y **sólo `categoria` estaba montada**.
 */
describe("varianteDeCriterio", () => {
  it("los categóricos usan la tarjeta de categoría", () => {
    for (const id of ["modality", "session_type", "teacher_type", "condicion_curso", "campus"]) {
      expect(varianteDeCriterio(id), id).toBe("categoria");
    }
  });

  it("los de corte usan la de umbral", () => {
    for (const id of ["minEligible", "elegibles_por_aula", "enrolled_total", "course_level"]) {
      expect(varianteDeCriterio(id), id).toBe("umbral");
    }
  });

  it("composición y sus sub-reglas usan la de proporción", () => {
    // Llegan con sufijo por sub-regla; son la misma pregunta sobre la misma
    // escala, así que el prefijo decide.
    for (const id of ["composition", "composition_facultad", "composition_nivel", "c7", "c8"]) {
      expect(varianteDeCriterio(id), id).toBe("proporcion");
    }
  });

  it("la selección uno a uno usa la de unidad", () => {
    expect(varianteDeCriterio("manual_excluded")).toBe("unidad");
  });

  it("un criterio desconocido cae en categoría, no rompe", () => {
    // Inventarle una variante a un criterio nuevo seria peor que darle la
    // genérica: la de categoría muestra todo y no promete nada que no tenga.
    expect(varianteDeCriterio("inventado")).toBe("categoria");
    expect(varianteDeCriterio(null)).toBe("categoria");
  });

  it("las cuatro variantes están cubiertas por el mapa", () => {
    // Un mapa que nunca devuelve una variante la deja sin montar — que es
    // exactamente el defecto que este módulo viene a cerrar.
    const vistas = new Set([
      varianteDeCriterio("modality"),
      varianteDeCriterio("minEligible"),
      varianteDeCriterio("composition"),
      varianteDeCriterio("manual_excluded"),
    ]);
    expect(vistas).toEqual(new Set(["categoria", "umbral", "proporcion", "unidad"]));
  });
});

describe("unidadEjeDeCriterio", () => {
  it("una proporción se rotula en porcentaje", () => {
    expect(unidadEjeDeCriterio("proporcion")).toContain("%");
  });

  it("un umbral y una categoría se rotulan en estudiantes", () => {
    expect(unidadEjeDeCriterio("umbral")).toContain("estudiantes elegibles");
    expect(unidadEjeDeCriterio("categoria")).toContain("estudiantes elegibles");
  });
});
