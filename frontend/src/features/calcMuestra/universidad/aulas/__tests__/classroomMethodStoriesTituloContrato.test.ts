/**
 * Un método, un nombre.
 *
 * `CLASSROOM_METHOD_STORIES` declaraba su propio `title` y tres de los cuatro
 * métodos no coincidían con el `label` canónico de las constantes: la pestaña
 * Método decía «Sistemático PPS» donde Simulación decía «Sistemático por
 * facultad», «Balanceado (cube)» donde la otra decía «Balance por cuotas y
 * tamaño» y «Pool controlado» donde la otra decía «Optimizar repetidos».
 * Preguntar por el nombre que se ve en una pestaña no tenía respuesta en la
 * pestaña que explica los métodos.
 */
import { describe, expect, it } from "vitest";
import { CLASSROOM_METHOD_STORIES } from "../classroomMethodStoriesModel";
import { classroomMethodLabel } from "../classroomLabels";
import { UNIVERSITY_AULAS_SELECTOR_OPTIONS } from "../../shared/constants";

describe("el nombre del método lo declara una sola fuente", () => {
  it("ninguna historia declara un título propio", () => {
    for (const story of CLASSROOM_METHOD_STORIES) {
      expect(Object.keys(story)).not.toContain("title");
      expect(Object.keys(story)).not.toContain("label");
    }
  });

  it("cada historia resuelve su nombre contra las opciones canónicas", () => {
    for (const story of CLASSROOM_METHOD_STORIES) {
      const canonico = UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((o) => o.id === story.id);
      expect(canonico, `el método ${story.id} no existe en las opciones canónicas`).toBeTruthy();
      expect(classroomMethodLabel(story.id)).toBe(canonico?.label);
      // Sin esto, un id que no existiera devolvería el id crudo y pasaría.
      expect(classroomMethodLabel(story.id)).not.toBe(story.id);
    }
  });

  it("las explicaciones canónicas no reintroducen jerga sin glosa", () => {
    const prohibidos = ["auxiliares buenas", "marco depurado", "probabilidades finales"];
    for (const option of UNIVERSITY_AULAS_SELECTOR_OPTIONS) {
      for (const termino of prohibidos) {
        expect(option.detail.toLowerCase()).not.toContain(termino);
      }
    }
  });
});
