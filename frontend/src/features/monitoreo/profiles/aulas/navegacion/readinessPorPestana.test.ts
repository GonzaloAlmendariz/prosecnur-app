import { describe, expect, it } from "vitest";

import { AULAS_SECCIONES_PUBLICAS } from "../../../core/monitoreoRegistry";
import { readinessDeAulas, seccionesDeAulas, vistasDeAulas } from "./readinessDeAulas";

/**
 * Meta B, L10: Cursos-horario publicaba `monitoreo-aulas` en todas sus vistas.
 * Cada pestaña publica ahora la suya, con su dirección PÚBLICA (revamp del
 * esqueleto común, 2026-10-23): Insumos, Modelo, Control y Avance.
 */
describe("readiness por pestaña de cursos-horario", () => {
  const vistas = vistasDeAulas();

  it("cada vista principal publica una marca distinta", () => {
    // 3 de Insumos + 2 de Modelo + 8 de Control + 5 de Avance.
    expect(vistas.length).toBe(18);
    expect(new Set(vistas.map((v) => v.marca)).size).toBe(vistas.length);
  });

  it("la marca es la dirección, no un booleano", () => {
    for (const { seccion, pestana, marca } of vistas) {
      expect(marca).toBe(pestana ? `monitoreo-aulas-${seccion}-${pestana}` : `monitoreo-aulas-${seccion}`);
      expect(marca).not.toBe("true");
      expect(marca).not.toBe("monitoreo-aulas");
    }
  });

  it("cubre todas las secciones que nombra la barra del modo", () => {
    const montadas = AULAS_SECCIONES_PUBLICAS.map((def) => def.key).sort();
    expect([...seccionesDeAulas()].sort()).toEqual(montadas);
  });

  it("una pestaña ajena no hereda la marca de la primera de la sección", () => {
    expect(readinessDeAulas("avance", "no-existe")).toBe("monitoreo-aulas-avance-no-existe");
    expect(readinessDeAulas("avance", "no-existe")).not.toBe(readinessDeAulas("avance", "resumen"));
  });

  it("una sección sin pestaña publica la marca de la sección", () => {
    expect(readinessDeAulas("insumos", "")).toBe("monitoreo-aulas-insumos");
  });

  it("dos pestañas que montan la misma vista heredada publican marcas distintas", () => {
    // Insumos › Fuentes e Insumos › Reglas montan hoy la hoja Fuentes.
    expect(readinessDeAulas("insumos", "fuentes")).not.toBe(readinessDeAulas("insumos", "reglas"));
  });
});
