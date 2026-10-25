import { describe, expect, it } from "vitest";

import { AULAS_WORKBENCH_VIEWS } from "../../../core/monitoreoRegistry";
import { readinessDeAulas, seccionesDeAulas, vistasDeAulas } from "./readinessDeAulas";

/**
 * Meta B, L10: Cursos-horario publicaba `monitoreo-aulas` en todas sus vistas.
 * Cada pestaña publica ahora la suya, con su dirección.
 */
describe("readiness por pestaña de cursos-horario", () => {
  const vistas = vistasDeAulas();

  it("cada vista principal publica una marca distinta", () => {
    // 1 (Fuentes, sin pestañas) + 4 de Agenda + 5 de Validación + 5 de
    // Consultas + 5 de Avance.
    expect(vistas.length).toBeGreaterThanOrEqual(20);
    expect(new Set(vistas.map((v) => v.marca)).size).toBe(vistas.length);
  });

  it("la marca es la dirección, no un booleano", () => {
    for (const { seccion, pestana, marca } of vistas) {
      expect(marca).toBe(pestana ? `monitoreo-aulas-${seccion}-${pestana}` : `monitoreo-aulas-${seccion}`);
      expect(marca).not.toBe("true");
      expect(marca).not.toBe("monitoreo-aulas");
    }
  });

  it("cubre todas las secciones que monta la página", () => {
    const montadas = AULAS_WORKBENCH_VIEWS.map((def) => def.key).sort();
    expect([...seccionesDeAulas()].sort()).toEqual(montadas);
  });

  it("una pestaña ajena no hereda la marca de la primera de la sección", () => {
    expect(readinessDeAulas("avance", "no-existe")).toBe("monitoreo-aulas-avance-no-existe");
    expect(readinessDeAulas("avance", "no-existe")).not.toBe(readinessDeAulas("avance", "resumen"));
  });

  it("Fuentes, que no tiene pestañas, publica la marca de la sección", () => {
    expect(readinessDeAulas("fuentes", "")).toBe("monitoreo-aulas-fuentes");
  });
});
