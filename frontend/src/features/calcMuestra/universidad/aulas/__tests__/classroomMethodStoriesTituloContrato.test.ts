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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

describe("ninguna superficie declara su propio nombre de método", () => {
  const leer = (rel: string) =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

  it("el comparador didáctico no reintroduce un juego de nombres propio", () => {
    // Tenía «Sorteo balanceado multidimensional», «Salto sistemático
    // proporcional al tamaño»… mientras las otras dos superficies de la MISMA
    // pestaña usaban otros dos juegos. Cuatro métodos, tres nombres cada uno.
    const fuente = leer("../../../didactica/ComparadorMetodosVisual.tsx");
    const sinComentarios = fuente.replace(/\/\*[^]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(sinComentarios).not.toMatch(/\bnombre:\s*"/);
    expect(sinComentarios).toContain("classroomMethodLabel");
  });

  it("el rótulo del comparador cuenta los métodos que hay", () => {
    // Decía «Dos formas de sortear» sobre cuatro tarjetas.
    const fuente = leer("../../../didactica/ComparadorMetodosVisual.tsx");
    expect(fuente).not.toContain("Dos formas de sortear, medidas");
    expect(fuente).toContain("metodos.length");
  });

  it("las opciones canónicas cubren todo método que la UI pueda recibir", () => {
    const ids = UNIVERSITY_AULAS_SELECTOR_OPTIONS.map((o) => o.id);
    for (const id of ["sistematico_pps", "cube_balanceado", "local_pivotal_balanceado", "pool_controlado"]) {
      expect(ids).toContain(id);
    }
  });
});
