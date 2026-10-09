import { describe, expect, it } from "vitest";

import { DEFAULT_UNIVERSITY_AULAS_CONFIG } from "./constants";

/**
 * «Ningún criterio es global, todos los criterios siempre son por facultad,
 * porque precisamente va a pasar lo que pasa en arte, o en otras facultades
 * pequeñas, donde un criterio global sacrifica un montón en una facultad
 * chiquita.» — Gonzalo, 2026-08-25.
 */
describe("el proyecto nuevo no llega con criterios que nadie eligió", () => {
  it("el mínimo de elegibles por aula NO recorta por defecto", () => {
    // Con 15 —el valor anterior— un proyecto recién creado ya llegaba con
    // 3.491 de 5.269 cursos-horario, y el recorte caía desigual: Artes
    // Escénicas 45 de 440. Sin criterios declarados, elegibles = universo.
    expect(DEFAULT_UNIVERSITY_AULAS_CONFIG.min_elegibles_aula).toBe(1);
  });

  it("y el motor R declara el mismo default, porque este valor lo pisa", () => {
    // El front siembra el workspace y R lo lee como alias de
    // `min_eligible_per_class`: corregir sólo el motor NO se veía en la app.
    // Este test no puede leer R, así que fija la intención por escrito y deja
    // el rastro para quien cambie uno de los dos.
    const ESPEJO_DEL_MOTOR_R = 1; // calc_muestra_aulas.R · default_config()$filters
    expect(DEFAULT_UNIVERSITY_AULAS_CONFIG.min_elegibles_aula).toBe(ESPEJO_DEL_MOTOR_R);
  });
});
