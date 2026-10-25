import { describe, expect, it } from "vitest";
import { corteAcreditacion, corteAulas, corteTerritorial } from "./corteAdapters";
import { construirCorte, readinessDeSalidas } from "./corteContract";

/**
 * Cierre de QA (2026-10-25). Dos defectos del estado del corte en Salidas:
 *
 * - «El corte quedó desactualizado desde la última sincronización; vuelve a
 *   sincronizar antes de publicar»: el hecho y la acción pegados tras un «;».
 *   El hecho queda corto; la acción viaja aparte (`accion`, tooltip del botón).
 * - «Procesables 2,296 pasan el filtro» en telefónico, a dos pestañas de
 *   «424 pasan el filtro de efectiva»: casi el mismo rótulo para dos cifras.
 *   En telefónico y acreditación el procesable es la suma de universos.
 */
describe("bloqueos del corte: hecho corto, acción aparte", () => {
  const estados = ["partial", "stale", "failed", "reindexing", ""];
  for (const estado of estados) {
    it(`generation_status «${estado}»: sin «;» ni «:» y con acción`, () => {
      const r = readinessDeSalidas(construirCorte({ ingesta: 10, procesable: 10, oficial: 10, hasSnapshot: true, generationStatus: estado }));
      const bloqueo = r.bloqueos.find((b) => b.codigo === "CORTE_INCOMPLETO");
      expect(bloqueo).toBeTruthy();
      expect(bloqueo?.mensaje).not.toMatch(/[;:]/);
      expect(bloqueo?.accion).toBeTruthy();
    });
  }

  it("stale dice el hecho y deja la acción fuera del mensaje", () => {
    const r = readinessDeSalidas(construirCorte({ ingesta: 10, procesable: 10, oficial: 10, hasSnapshot: true, generationStatus: "stale" }));
    const bloqueo = r.bloqueos.find((b) => b.codigo === "CORTE_INCOMPLETO");
    expect(bloqueo?.mensaje).toBe("El corte está desactualizado.");
    expect(bloqueo?.mensaje).not.toContain("sincroniz");
    expect(bloqueo?.accion).toContain("sincronizar");
  });

  it("ningún bloqueo conocido encadena una explicación", () => {
    const sinValidas = readinessDeSalidas(construirCorte({ ingesta: 5, procesable: 5, oficial: 0, hasSnapshot: true, generationStatus: "complete", fuentesActivas: 1, fuentesRequeridas: 3 }));
    expect(sinValidas.bloqueos.map((b) => b.codigo).sort()).toEqual(["FUENTES_INCOMPLETAS", "SIN_VALIDAS"]);
    for (const bloqueo of sinValidas.bloqueos) {
      expect(bloqueo.mensaje).not.toMatch(/[;:]/);
      expect(bloqueo.accion ?? "").not.toMatch(/[;:]/);
    }
  });
});

describe("el procesable dice lo que mide en cada modo", () => {
  it("acreditación y telefónico: universo declarado, no un filtro", () => {
    const corte = corteAcreditacion({ n_rows: 2726, has_snapshot: true } as never, [{ universe: 2296, effective: 423, meta: 400 }]);
    expect(corte.procesable).toBe(2296);
    expect(corte.procesableEtiqueta).toBe("en el universo declarado");
  });

  it("territorial: las que tienen consentimiento", () => {
    expect(corteTerritorial(null, { kpis: { consentidas: 5 } } as never).procesableEtiqueta).toBe("con consentimiento");
  });

  it("cursos-horario: el filtro de aplicación", () => {
    expect(corteAulas(null, null).procesableEtiqueta).toBe("en el filtro de aplicación");
  });

  it("ningún modo lo rotula «pasan el filtro»", () => {
    const etiquetas = [
      corteAcreditacion(null, []).procesableEtiqueta,
      corteTerritorial(null, null).procesableEtiqueta,
      corteAulas(null, null).procesableEtiqueta,
      construirCorte({}).procesableEtiqueta,
    ];
    for (const etiqueta of etiquetas) expect(etiqueta).not.toContain("pasan el filtro");
  });
});
