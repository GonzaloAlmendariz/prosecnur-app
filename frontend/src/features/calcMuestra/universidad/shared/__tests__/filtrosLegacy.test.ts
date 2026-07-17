/**
 * §ADR 0035 (§4.1.1): sin suite de criterios definida, el bloque `filters` del
 * build viaja PERMISIVO (ningún criterio asumido). El config normalizado siempre
 * rellena sus defaults (pregrado/regular/≥18/docente estable), así que el corte
 * por suite es lo único que evita filtrar en silencio. Con la suite activa el
 * comportamiento previo se conserva (R gobierna y neutraliza estos flags).
 */
import { describe, expect, it } from "vitest";
import { filtrosLegacyPayload, normalizeUniversityAulasConfig } from "../study";

const sinOpcionales = { c7: false, c8: false };

describe("filtrosLegacyPayload — suite inactiva ⇒ permisivo", () => {
  const config = { ...normalizeUniversityAulasConfig(), min_elegibles_aula: 12 };

  it("desactiva todos los criterios legacy pese a los defaults del config", () => {
    // El config normalizado nace con criterios encendidos por sus defaults…
    expect(config.require_undergraduate).toBe(true);
    expect(config.accepted_formation_patterns).toEqual(["pregrado"]);
    // …pero sin suite activa el payload los apaga todos.
    const filters = filtrosLegacyPayload(config, false, sinOpcionales);
    expect(filters).toMatchObject({
      require_undergraduate: false,
      require_adult: false,
      require_in_person: false,
      require_stable_teacher: false,
      accepted_conditions: [],
      accepted_formation_patterns: [],
      accepted_teacher_type_patterns: [],
      exclude_session_patterns: [],
      exclude_modality_patterns: [],
      exclude_level_patterns: [],
      accepted_campuses: [],
      nivel_por_unidad: {},
      session_type_excepciones: {},
      require_min_prevalence: false,
      require_cycle_homogeneity: false,
    });
  });

  it("conserva el umbral estructural min_eligible_per_class", () => {
    const filters = filtrosLegacyPayload(config, false, sinOpcionales);
    expect(filters.min_eligible_per_class).toBe(12);
  });

  it("ignora los opcionales c7/c8 cuando la suite está inactiva", () => {
    const filters = filtrosLegacyPayload(config, false, { c7: true, c8: true });
    expect(filters.require_min_prevalence).toBe(false);
    expect(filters.require_cycle_homogeneity).toBe(false);
  });

  it("apaga el criterio 8 · paso 1 (facultad) aunque el config lo encienda", () => {
    const encendido = { ...config, require_faculty_prevalence: true };
    const filters = filtrosLegacyPayload(encendido, false, sinOpcionales);
    expect(filters.require_faculty_prevalence).toBe(false);
    expect(filters.min_faculty_prevalence_pct).toBe(0.8);
  });
});

describe("filtrosLegacyPayload — suite activa ⇒ comportamiento previo", () => {
  const config = { ...normalizeUniversityAulasConfig(), min_elegibles_aula: 10 };

  it("envía los valores del config tal como estaban", () => {
    const filters = filtrosLegacyPayload(config, true, sinOpcionales);
    expect(filters).toMatchObject({
      require_undergraduate: config.require_undergraduate,
      accepted_formation_patterns: config.accepted_formation_patterns,
      accepted_teacher_type_patterns: config.accepted_teacher_type_patterns,
      min_eligible_per_class: 10,
    });
  });

  it("aplica los opcionales c7/c8 del Motor/Recorrido", () => {
    const filters = filtrosLegacyPayload(config, true, { c7: true, c8: false });
    expect(filters.require_min_prevalence).toBe(true);
    expect(filters.require_cycle_homogeneity).toBe(false);
  });

  it("criterio 8 · paso 1 (facultad) fluye desde la tarjeta de criterios", () => {
    const encendido = { ...config, require_faculty_prevalence: true, min_faculty_prevalence_pct: 0.7 };
    const filters = filtrosLegacyPayload(encendido, true, sinOpcionales);
    expect(filters.require_faculty_prevalence).toBe(true);
    expect(filters.min_faculty_prevalence_pct).toBe(0.7);
  });

  it("criterio 8 · paso 2 (nivel) se activa desde el config O el opcional del Motor", () => {
    const desdeConfig = filtrosLegacyPayload(
      { ...config, require_cycle_homogeneity: true },
      true,
      sinOpcionales,
    );
    expect(desdeConfig.require_cycle_homogeneity).toBe(true);
    const desdeMotor = filtrosLegacyPayload(config, true, { c7: false, c8: true });
    expect(desdeMotor.require_cycle_homogeneity).toBe(true);
  });
});
