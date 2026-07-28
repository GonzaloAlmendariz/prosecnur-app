import { describe, expect, it } from "vitest";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../api/client";
import { corteAcreditacion, corteTerritorial } from "./corteAdapters";
import { readinessDeSalidas } from "./corteContract";

function estado(overrides: Partial<MonitoreoState> = {}) {
  return {
    has_snapshot: true,
    n_rows: 36,
    synced_at: "2026-07-20T10:00:00Z",
    generation_status: "complete",
    ...overrides,
  } as unknown as MonitoreoState;
}

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    generated_at: "2026-07-20T10:00:00Z",
    kpis: { total_respuestas: 36, consentidas: 22, validas: 0, meta: 24 },
    advance: { validas: 0, meta: 24 },
    ...overrides,
  } as unknown as MonitoreoTerritorialDashboard;
}

describe("corteTerritorial", () => {
  it("nombra los tres granos del caso auditado", () => {
    const corte = corteTerritorial(estado(), dashboard());
    expect(corte.ingesta).toBe(36);
    expect(corte.procesable).toBe(22);
    expect(corte.oficial).toBe(0);
    expect(corte.meta).toBe(24);
  });

  it("bloquea las salidas de cliente aunque el snapshot tenga 36 filas", () => {
    const readiness = readinessDeSalidas(corteTerritorial(estado(), dashboard()));
    expect(readiness.puedePublicarCliente).toBe(false);
    expect(readiness.bloqueos.map((b) => b.codigo)).toContain("SIN_VALIDAS");
  });

  it("prefiere el bloque advance sobre los kpis para el oficial", () => {
    const corte = corteTerritorial(
      estado(),
      dashboard({ kpis: { total_respuestas: 36, consentidas: 22, validas: 5, meta: 24 }, advance: { validas: 3, meta: 24 } }),
    );
    expect(corte.oficial).toBe(3);
  });

  it("cae a los kpis cuando no hay bloque advance", () => {
    const corte = corteTerritorial(estado(), dashboard({ advance: undefined }));
    expect(corte.oficial).toBe(0);
    expect(corte.procesable).toBe(22);
  });

  it("sin reports deja el oficial sin determinar en vez de asumir cero", () => {
    const corte = corteTerritorial(estado(), null);
    expect(corte.oficial).toBeNull();
    expect(readinessDeSalidas(corte).bloqueos.map((b) => b.codigo)).toContain("OFICIAL_INDETERMINADO");
  });

  it("cada salto explica su regla y trae dirección", () => {
    const corte = corteTerritorial(estado(), dashboard());
    expect(corte.saltos).toHaveLength(2);
    for (const salto of corte.saltos) {
      expect(salto.regla).toBeTruthy();
      expect(salto.direccion).toBeTruthy();
    }
  });
});

describe("corteAcreditacion", () => {
  const aportes = [
    { universe: 120, effective: 80, meta: 100 },
    { universe: 60, effective: 40, meta: 50 },
  ];

  it("suma efectivas y metas de las tarjetas por actor", () => {
    const corte = corteAcreditacion(estado({ n_rows: 200 }), aportes);
    expect(corte.procesable).toBe(180);
    expect(corte.oficial).toBe(120);
    expect(corte.meta).toBe(150);
  });

  it("sin tarjetas el oficial queda sin determinar, no en cero", () => {
    // Este es el caso `EFECTIVAS S/D` que convivía con botones habilitados.
    const corte = corteAcreditacion(estado(), []);
    expect(corte.oficial).toBeNull();
    const readiness = readinessDeSalidas(corte);
    expect(readiness.puedePublicarCliente).toBe(false);
    expect(readiness.estado).toBe("no-evaluado");
  });

  it("sin metas declaradas no inventa un denominador", () => {
    const corte = corteAcreditacion(estado(), [{ universe: 10, effective: 4, meta: null }]);
    expect(corte.meta).toBeNull();
    expect(corte.avancePct).toBeNull();
  });

  it("un corte completo con efectivas habilita la publicación", () => {
    const readiness = readinessDeSalidas(corteAcreditacion(estado({ n_rows: 200 }), aportes));
    expect(readiness.puedePublicarCliente).toBe(true);
  });

  it("un corte pendiente bloquea aunque haya efectivas", () => {
    const readiness = readinessDeSalidas(
      corteAcreditacion(estado({ n_rows: 200, generation_status: "partial" }), aportes),
    );
    expect(readiness.puedePublicarCliente).toBe(false);
    expect(readiness.bloqueos.map((b) => b.codigo)).toContain("CORTE_INCOMPLETO");
  });
});
