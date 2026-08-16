/**
 * Un estudio nuevo nace con la coherencia de facultad encendida.
 *
 * El criterio 8 · paso 1 —«los elegibles del aula son en su mayoría de la
 * facultad bajo la que está catalogado el curso»— nació apagado. Sobre el
 * estudio real de HSyVBG 2026 eso dejaba en el marco cursos-horario que no
 * pueden atribuirse a su propia facultad; encenderlo al 80% recortó 252 CH y
 * dejó 190 titulares, cuatro menos que los 194 de 2025.
 *
 * Lo que este archivo fija es el ALCANCE, que es la parte que puede hacer daño
 * en silencio: qué proyectos heredan el nuevo valor y cuáles conservan el suyo.
 */
import { describe, expect, it } from "vitest";

import type { CalcMuestraWorkspaceAulasConfig } from "../../../../../api/calcMuestra";
import { DEFAULT_UNIVERSITY_AULAS_CONFIG } from "../constants";
import { filtrosLegacyPayload, normalizeUniversityAulasConfig } from "../study";

/**
 * La firma de `normalizeUniversityAulasConfig` pide la config entera, pero por
 * dentro la trata como `Partial` —es su trabajo: rellenar lo que falte—. Estos
 * tests existen justamente para los objetos incompletos que llegan de un
 * `.pulso`, así que el cast es deliberado y no tapa un error de tipos real.
 */
const parcial = (value: Record<string, unknown>) =>
  value as unknown as CalcMuestraWorkspaceAulasConfig;

describe("el default de la coherencia de facultad", () => {
  it("nace encendido y al 80%", () => {
    expect(DEFAULT_UNIVERSITY_AULAS_CONFIG.require_faculty_prevalence).toBe(true);
    expect(DEFAULT_UNIVERSITY_AULAS_CONFIG.min_faculty_prevalence_pct).toBe(0.8);
  });

  it("el paso 2 sigue apagado en el payload que recibe el motor", () => {
    // Encender los dos a la vez haría imposible saber qué recortó qué, y el
    // paso 2 no participó de la medición que justificó el paso 1.
    //
    // Se comprueba sobre el payload y no sobre el objeto de defaults porque
    // `require_cycle_homogeneity` NO está declarada ahí: un
    // `expect(DEFAULT.require_cycle_homogeneity ?? false).toBe(false)` pasaría
    // por `undefined` sin fijar nada. Lo que importa es lo que viaja a R.
    const payload = filtrosLegacyPayload(
      normalizeUniversityAulasConfig(undefined),
      true,
      { c7: false, c8: false },
    );
    expect(payload.require_faculty_prevalence).toBe(true);
    expect(payload.min_faculty_prevalence_pct).toBe(0.8);
    expect(payload.require_cycle_homogeneity).toBe(false);
  });

  it("con la suite apagada no viaja encendido", () => {
    // La rama legacy manda todo permisivo a propósito: el usuario no eligió
    // criterios, así que el marco no puede filtrar por uno.
    const payload = filtrosLegacyPayload(
      normalizeUniversityAulasConfig(undefined),
      false,
      { c7: false, c8: false },
    );
    expect(payload.require_faculty_prevalence).toBe(false);
  });

  it("un estudio sin config nace con la coherencia encendida", () => {
    // El caso que pidió Gonzalo: proyecto nuevo, nada guardado todavía.
    expect(normalizeUniversityAulasConfig(undefined).require_faculty_prevalence).toBe(true);
    expect(normalizeUniversityAulasConfig(null).require_faculty_prevalence).toBe(true);
    expect(normalizeUniversityAulasConfig(parcial({})).require_faculty_prevalence).toBe(true);
  });
});

describe("qué pasa con los proyectos ya guardados", () => {
  it("un .pulso que trae el campo conserva SU valor, no el default", () => {
    // Lo que hace inofensivo el cambio para los estudios existentes: en
    // `normalizeUniversityAulasConfig` el spread de `raw` va después del de
    // DEFAULT, así que un valor guardado gana siempre. Medido sobre el
    // proyecto de referencia `hsvg2026`, cuyo `aulas_config` viaja con 54
    // campos, este entre ellos.
    const apagado = normalizeUniversityAulasConfig(parcial({
      require_faculty_prevalence: false,
      min_faculty_prevalence_pct: 0.8,
    }));
    expect(apagado.require_faculty_prevalence).toBe(false);

    const conUmbralPropio = normalizeUniversityAulasConfig(parcial({
      require_faculty_prevalence: true,
      min_faculty_prevalence_pct: 0.65,
    }));
    expect(conUmbralPropio.require_faculty_prevalence).toBe(true);
    expect(conUmbralPropio.min_faculty_prevalence_pct).toBe(0.65);
  });

  it("un proyecto anterior al campo SÍ hereda el nuevo default", () => {
    // El único caso en que el cambio alcanza a un estudio existente, y por eso
    // se fija aquí en vez de dejarlo implícito: un `.pulso` guardado antes de
    // que la clave existiera (previo a 2026-07-15) no la trae, y al abrirse
    // toma la del default. No es distinguible de un estudio nuevo desde esta
    // función —ambos llegan sin la clave—, así que se documenta en vez de
    // adivinarse con una heurística.
    const viejo = normalizeUniversityAulasConfig(parcial({
      modalidad: "presencial_aula",
      min_elegibles_aula: 5,
    }));
    expect(viejo.require_faculty_prevalence).toBe(true);
  });
});
