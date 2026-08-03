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

  it("composición usa la de proporción: su distribución YA es un porcentaje", () => {
    /*
     * G25 → G38 · Este caso fijaba la decisión contraria, y contarlo entero vale
     * más que sustituirlo en silencio.
     *
     * G25 midió un defecto real —«Q1 23 %, mediana 30 %» y un eje hasta 200 %—
     * y lo diagnosticó bien: se rotulaba el gráfico con la unidad del UMBRAL
     * teniendo el dato del conteo. Pero reparó cambiando la etiqueta en vez del
     * dato, y composición se quedó decidiéndose con un corte en % mientras su
     * gráfico contaba alumnos.
     *
     * G38 trae el dato correcto: el motor publica `signal_distribution` en
     * porcentaje con escala 0–100. La variante vuelve a `proporcion` porque
     * ahora sí la sostiene un dato que lo es.
     */
    for (const id of ["composition", "composition_facultad", "composition_nivel", "c7", "c8"]) {
      expect(varianteDeCriterio(id), id).toBe("proporcion");
    }
  });

  it("ninguna variante se aplica sobre un dato que no la sostiene", () => {
    // La regla que sobrevive al cambio de decisión, que era lo que G25 protegía
    // de verdad: `proporcion` sólo va donde el dato es una proporción. Un
    // criterio de conteo no la usa por mucho que su control se fije en %.
    const ids = ["modality", "minEligible", "manual_excluded", "course_level", "enrolled_total"];
    expect(ids.map(varianteDeCriterio)).not.toContain("proporcion");
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

  it("las variantes que el dato sostiene están todas montadas", () => {
    // Un mapa que nunca devuelve una variante la deja sin montar. `proporcion`
    // es la excepción declarada: no hay dato que la sostenga todavía.
    const vistas = new Set([
      varianteDeCriterio("modality"),
      varianteDeCriterio("minEligible"),
      varianteDeCriterio("manual_excluded"),
    ]);
    expect(vistas).toEqual(new Set(["categoria", "umbral", "unidad"]));
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
