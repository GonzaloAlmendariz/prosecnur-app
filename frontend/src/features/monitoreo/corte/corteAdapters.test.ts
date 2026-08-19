import { describe, expect, it } from "vitest";
import type {
  MonitoreoAulasDashboard,
  MonitoreoState,
  MonitoreoTerritorialDashboard,
} from "../../../api/client";
import { corteAcreditacion, corteAulas, corteTerritorial } from "./corteAdapters";
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

describe("corteAulas", () => {
  function aula(overrides: Record<string, unknown> = {}) {
    return { sample_role: "titular", expected_valid: 10, ...overrides };
  }

  function dashboardAulas(overrides: Record<string, unknown> = {}) {
    return {
      generated_at: "2026-07-20T10:00:00Z",
      kpis: { total_aulas: 3, aulas_aplicadas: 2, respuestas_validas: 18, filter_passed: 24, brechas: 1 },
      agenda: [aula(), aula(), aula()],
      // La meta la publica el MOTOR y viaja con la serie del ritmo.
      ritmo_diario: { dias: [], dias_con_campo: 0, media_diaria: 0, meta: 30 },
      ...overrides,
    } as unknown as MonitoreoAulasDashboard;
  }

  it("nombra los tres granos del perfil", () => {
    const corte = corteAulas(estado({ n_rows: 30 }), dashboardAulas());
    expect(corte.ingesta).toBe(30);
    expect(corte.procesable).toBe(24);
    expect(corte.oficial).toBe(18);
    expect(corte.meta).toBe(30);
  });

  it("la meta es la del motor y NO se recompone desde la agenda", () => {
    // Sumar `expected_valid` sobre la agenda da 4 336 donde el estudio pide
    // 3 743: la agenda trae TODOS los eslabones de cada cadena y la meta es de
    // una aula por cadena, la que está en juego. La tarjeta de Salidas decía
    // «meta 4 336» mientras Avance decía 3 743 en tres paneles.
    //
    // Se fija con una agenda que suma OTRA cosa a propósito: si alguien vuelve
    // a recomponer la meta acá, este aserto lo dice.
    const corte = corteAulas(
      estado(),
      dashboardAulas({
        agenda: [aula(), aula(), aula(), aula(), aula(), aula()],
        ritmo_diario: { dias: [], dias_con_campo: 0, media_diaria: 0, meta: 30 },
      }),
    );
    expect(corte.meta).toBe(30);
  });

  it("sin meta del motor queda sin determinar, no en cero", () => {
    // Un cero se lee como «el estudio no pide nada» y dispara una lectura de
    // avance sobre un denominador inventado.
    const corte = corteAulas(
      estado(),
      dashboardAulas({ ritmo_diario: { dias: [], dias_con_campo: 0, media_diaria: 0, meta: 0 } }),
    );
    expect(corte.meta).toBeNull();
  });

  it("un aula que sobrecumple no sube la meta", () => {
    // `validas + brecha` habría dado 24: la brecha se satura en cero y el
    // sobrecumplimiento se colaba al denominador.
    const corte = corteAulas(
      estado(),
      dashboardAulas({
        kpis: { total_aulas: 2, aulas_aplicadas: 2, respuestas_validas: 24, filter_passed: 24, brechas: 0 },
        agenda: [aula(), aula()],
        ritmo_diario: { dias: [], dias_con_campo: 0, media_diaria: 0, meta: 20 },
      }),
    );
    expect(corte.meta).toBe(20);
    expect(corte.brecha).toBe(0);
  });

  it("sin dashboard el oficial queda sin determinar, no en cero", () => {
    const corte = corteAulas(estado(), null);
    expect(corte.oficial).toBeNull();
    expect(corte.meta).toBeNull();
    const readiness = readinessDeSalidas(corte);
    expect(readiness.puedePublicarCliente).toBe(false);
    expect(readiness.estado).toBe("no-evaluado");
  });

  it("un plan importado sin respuestas válidas bloquea la publicación", () => {
    const corte = corteAulas(
      estado({ n_rows: 0 }),
      dashboardAulas({ kpis: { total_aulas: 3, aulas_aplicadas: 0, respuestas_validas: 0, filter_passed: 0, brechas: 3 } }),
    );
    const readiness = readinessDeSalidas(corte);
    expect(readiness.puedePublicarCliente).toBe(false);
    expect(readiness.bloqueos.map((b) => b.codigo)).toContain("SIN_VALIDAS");
  });

  it("un corte completo con válidas habilita la publicación", () => {
    const readiness = readinessDeSalidas(corteAulas(estado({ n_rows: 30 }), dashboardAulas()));
    expect(readiness.puedePublicarCliente).toBe(true);
  });
});
