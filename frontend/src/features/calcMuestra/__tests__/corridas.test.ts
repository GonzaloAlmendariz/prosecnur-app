import { describe, expect, it } from "vitest";
import type { CalcMuestraCorrida, CalcMuestraWorkspace } from "../../../api/client";
import {
  CORRIDAS_MAX,
  corridaDeCalculo,
  corridaDeSeleccion,
  historialCorridas,
  jsonIgual,
  registrarCorrida,
} from "../corridas";
import { defaultComponente } from "../sharedCore";

function workspaceBase(overrides: Partial<CalcMuestraWorkspace> = {}): CalcMuestraWorkspace {
  return {
    version: 2,
    frame_mode: "opinion_universitaria",
    marco_disponible: "Base institucional",
    fuente_marco: "Registros académicos",
    unidad_observacion: "Estudiante",
    unidad_muestreo: "Aula",
    variables_control: [],
    escenarios: [],
    notas_diseno: "",
    ...overrides,
  };
}

function corrida(id: string, extra: Partial<CalcMuestraCorrida> = {}): CalcMuestraCorrida {
  return {
    id,
    timestamp: `2026-07-08T10:00:${id.padStart(2, "0")}Z`,
    tipo: "calculo",
    n_objetivo: 380,
    ...extra,
  };
}

describe("historialCorridas (retrocompatibilidad)", () => {
  it("devuelve [] para workspaces viejos sin run_history", () => {
    expect(historialCorridas(workspaceBase())).toEqual([]);
  });

  it("devuelve [] para workspace null/undefined", () => {
    expect(historialCorridas(null)).toEqual([]);
    expect(historialCorridas(undefined)).toEqual([]);
  });

  it("filtra entradas malformadas sin romper", () => {
    const ws = workspaceBase({
      run_history: [corrida("1"), null, { timestamp: "x" }, corrida("2")] as never,
    });
    expect(historialCorridas(ws).map((c) => c.id)).toEqual(["1", "2"]);
  });
});

describe("registrarCorrida (cap y orden)", () => {
  it("agrega la corrida al final (orden cronológico) sin mutar el original", () => {
    const ws = workspaceBase({ run_history: [corrida("1")] });
    const next = registrarCorrida(ws, corrida("2"));
    expect(historialCorridas(next).map((c) => c.id)).toEqual(["1", "2"]);
    expect(historialCorridas(ws).map((c) => c.id)).toEqual(["1"]);
  });

  it("crea el campo en workspaces viejos sin run_history", () => {
    const next = registrarCorrida(workspaceBase(), corrida("1"));
    expect(historialCorridas(next).map((c) => c.id)).toEqual(["1"]);
  });

  it("respeta el cap de 12 en FIFO: se descartan las más antiguas", () => {
    let ws = workspaceBase();
    for (let i = 1; i <= CORRIDAS_MAX + 3; i += 1) {
      ws = registrarCorrida(ws, corrida(String(i)));
    }
    const ids = historialCorridas(ws).map((c) => c.id);
    expect(ids).toHaveLength(CORRIDAS_MAX);
    expect(ids[0]).toBe("4"); // 1, 2 y 3 salieron
    expect(ids[ids.length - 1]).toBe("15");
  });
});

describe("corridaDeCalculo", () => {
  it("captura parámetros clave y n del resultado", () => {
    const comp = defaultComponente({ tecnica: "prob_estratificado" });
    comp.parametros = { ...comp.parametros, z: 1.96, e: 0.05, p: 0.5, deff: 1.2, oversample_pct: 0.1 };
    comp.resultado = {
      n_teorico: 370,
      n_objetivo: 384,
      n_operativo: 423,
      origen_tamano: "formula",
      tecnica: "prob_estratificado",
      computado_at: "2026-07-08T10:00:00Z",
      inferencia: { permitido: true, motivos: null },
    };
    const ws = workspaceBase({
      aulas_config: { semilla: 20260619 } as CalcMuestraWorkspace["aulas_config"],
    });
    const record = corridaDeCalculo({ totalComp: comp, workspace: ws });
    expect(record).not.toBeNull();
    expect(record?.tipo).toBe("calculo");
    expect(record?.metodo).toBe("prob_estratificado");
    expect(record?.semilla).toBe(20260619);
    expect(record?.n_objetivo).toBe(384);
    expect(record?.parametros).toMatchObject({ z: 1.96, e: 0.05, p: 0.5, deff: 1.2, sobremuestra: 0.1 });
  });

  it("devuelve null sin resultado útil", () => {
    expect(corridaDeCalculo({ totalComp: undefined, workspace: workspaceBase() })).toBeNull();
    expect(corridaDeCalculo({ totalComp: defaultComponente(), workspace: workspaceBase() })).toBeNull();
  });
});

describe("corridaDeSeleccion", () => {
  const aulasState = {
    selection: {
      schema: "calc_muestra_aulas_selection_v1",
      selection_run_id: "sel-1",
      generated_at: "2026-07-08T10:00:00Z",
      frame_hash: "abc123",
      seed: 777,
      selector: {},
      selector_engine_used: "cube_balanceado",
      representativity_score: 0.91,
      selection: [
        { sample_role: "titular", eligible_n: 30 },
        { sample_role: "titular", eligible_n: 25 },
        { sample_role: "chain_reserve", eligible_n: 28 },
        { sample_role: "extra_reserve_pool", eligible_n: 22 },
      ],
      quotas: [],
      summary: [],
    },
  } as never;

  it("resume titulares, reservas, esperados y representatividad", () => {
    const ws = workspaceBase({
      aulas_config: { semilla: 20260619, bolsas_reemplazo: 11 } as CalcMuestraWorkspace["aulas_config"],
    });
    const record = corridaDeSeleccion({ aulasState, workspace: ws });
    expect(record).not.toBeNull();
    expect(record?.tipo).toBe("seleccion");
    expect(record?.metodo).toBe("cube_balanceado");
    expect(record?.semilla).toBe(777); // prima la semilla real de la selección
    expect(record?.parametros?.waves).toBe(11);
    expect(record?.resumen).toMatchObject({
      titulares: 2,
      reservas: 2,
      esperados: 55,
      representatividad: 0.91,
    });
  });

  it("devuelve null sin selección con titulares", () => {
    expect(corridaDeSeleccion({ aulasState: null, workspace: workspaceBase() })).toBeNull();
  });
});

describe("jsonIgual (guardia de patches no-op)", () => {
  it("compara por valor, sin importar el orden de claves", () => {
    expect(jsonIgual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
  });

  it("trata undefined como clave ausente (criterio JSON)", () => {
    expect(jsonIgual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });

  it("detecta diferencias anidadas y de orden en arrays", () => {
    expect(jsonIgual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(jsonIgual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    expect(jsonIgual([1], [1, 2])).toBe(false);
    expect(jsonIgual(null, {})).toBe(false);
  });
});
