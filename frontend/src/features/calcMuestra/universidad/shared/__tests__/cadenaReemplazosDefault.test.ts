/**
 * El estudio nuevo nace con el candado y el objetivo del operativo de 2025.
 *
 * Dos defaults que se movieron juntos porque se sostienen entre sí:
 *
 * - `replacement_depth_strategy` pasa de exigir la CELDA entera a exigir la
 *   FACULTAD. De las 170 cadenas de 2025, ninguna mezcla facultades y 148
 *   mezclan tamaños: el reemplazo tenía que ser de la misma facultad y punto.
 * - `reserve_depth_target` pasa de 1 a 6. Valía 1 mientras el diseño construía
 *   cadenas de 11, así que un titular con una sola reserva pasaba por conforme
 *   y el aviso de profundidad no podía dispararse nunca.
 *
 * El orden importa: subir el objetivo sin aflojar el candado habría puesto en
 * rojo a 44 de 84 celdas que no pueden sostener la cadena por su ancho.
 */
import { describe, expect, it } from "vitest";

import type { CalcMuestraWorkspaceAulasConfig } from "../../../../../api/calcMuestra";
import { DEFAULT_UNIVERSITY_AULAS_CONFIG, DEFAULT_UNIVERSITY_AULAS_OBJECTIVE } from "../constants";
import { normalizeUniversityAulasConfig } from "../study";

const parcial = (value: Record<string, unknown>) =>
  value as unknown as CalcMuestraWorkspaceAulasConfig;

describe("el candado de la cadena", () => {
  it("nace por facultad, no por celda", () => {
    expect(DEFAULT_UNIVERSITY_AULAS_CONFIG.replacement_depth_strategy)
      .toBe("max_complete_chains_by_faculty");
    expect(normalizeUniversityAulasConfig(undefined).replacement_depth_strategy)
      .toBe("max_complete_chains_by_faculty");
  });

  it("un .pulso que trae su propia estrategia la conserva", () => {
    // Un estudio ya firmado con el candado de celda sigue con él: el default
    // gobierna a los nuevos, no reescribe los que ya sortearon.
    const guardado = normalizeUniversityAulasConfig(parcial({
      replacement_depth_strategy: "max_complete_chains_by_cell",
    }));
    expect(guardado.replacement_depth_strategy).toBe("max_complete_chains_by_cell");
  });
});

describe("el objetivo de profundidad de reservas", () => {
  it("deja de valer 1", () => {
    // Con el objetivo en 1 el aviso de profundidad nunca disparaba: cualquier
    // cadena lo cumplía a la primera reserva.
    expect(DEFAULT_UNIVERSITY_AULAS_OBJECTIVE.reserve_depth_target).toBe(6);
    expect(DEFAULT_UNIVERSITY_AULAS_OBJECTIVE.reserve_depth_target).toBeGreaterThan(1);
  });

  it("es alcanzable dentro del rango del precedente", () => {
    // 2025 armó cadenas de 3 a 12 sobre 12 olas: un objetivo fuera de ese rango
    // sería inalcanzable por diseño o no mediría nada.
    const objetivo = DEFAULT_UNIVERSITY_AULAS_OBJECTIVE.reserve_depth_target;
    expect(objetivo).toBeGreaterThanOrEqual(3);
    expect(objetivo).toBeLessThanOrEqual(12);
  });

  it("el estudio nuevo puede sostenerlo con la profundidad que declara", () => {
    // Un objetivo mayor que el techo de reservas por titular sería imposible de
    // cumplir por diseño, y el aviso quedaría encendido para siempre.
    const objetivo = DEFAULT_UNIVERSITY_AULAS_OBJECTIVE.reserve_depth_target ?? 0;
    const config = normalizeUniversityAulasConfig(undefined);
    expect(config.max_replacements_per_titular ?? 0).toBeGreaterThanOrEqual(objetivo);
    // Y el mínimo sigue por debajo: la primera reserva no lleva candado.
    expect(config.min_replacements_per_titular ?? 0).toBeLessThan(objetivo);
  });
});
