import { describe, expect, test } from "vitest";
import {
  SIN_ESTIMACION,
  duracionFase,
  formatReloj,
  normalizarEstimacionWarmup,
  relojWarmup,
  restanteMs,
  TIEMPO_WARMUP_INICIAL,
  tiempoWarmupReducer,
} from "./warmupTiempo";

describe("formatReloj", () => {
  test("es un cronómetro m:ss", () => {
    expect(formatReloj(0)).toBe("0:00");
    expect(formatReloj(4_200)).toBe("0:04");
    expect(formatReloj(160_000)).toBe("2:40");
    expect(formatReloj(3_725_000)).toBe("1:02:05");
  });

  test("un valor inválido no rompe el reloj", () => {
    expect(formatReloj(Number.NaN)).toBe("0:00");
    expect(formatReloj(-10)).toBe("0:00");
    expect(formatReloj(null)).toBe("0:00");
  });
});

describe("normalizarEstimacionWarmup", () => {
  test("lee la apertura anterior y las fases que publica el backend", () => {
    const est = normalizarEstimacionWarmup({
      ok: true,
      job_id: "j1",
      ultima_apertura: { elapsed_ms: 228000, at: "2026-10-09T10:00:00-0500" },
      tareas_ms: { monitoreo: 108000, project: 4000 },
    });
    expect(est.totalMs).toBe(228000);
    expect(est.at).toBe("2026-10-09T10:00:00-0500");
    expect(est.fasesMs).toEqual({ monitoreo: 108000, project: 4000 });
  });

  test("null serializado como {} y tareas vacías como [] son «sin apertura anterior»", () => {
    expect(normalizarEstimacionWarmup({ ultima_apertura: {}, tareas_ms: [] })).toBe(SIN_ESTIMACION);
    expect(normalizarEstimacionWarmup(undefined)).toBe(SIN_ESTIMACION);
    expect(normalizarEstimacionWarmup("x")).toBe(SIN_ESTIMACION);
  });

  test("descarta duraciones que no son positivas", () => {
    const est = normalizarEstimacionWarmup({
      ultima_apertura: { elapsed_ms: 0 },
      tareas_ms: { a: -1, b: "nada", c: 1200 },
    });
    expect(est.totalMs).toBeNull();
    expect(est.fasesMs).toEqual({ c: 1200 });
  });
});

describe("restante", () => {
  const est = normalizarEstimacionWarmup({ ultima_apertura: { elapsed_ms: 230000 } });

  test("sin apertura anterior no se inventa un restante", () => {
    expect(restanteMs(SIN_ESTIMACION, 10_000)).toBeNull();
    expect(relojWarmup(SIN_ESTIMACION, 10_000)).toEqual({ transcurrido: "0:10", restante: null, anterior: null });
  });

  test("con apertura anterior resta lo transcurrido", () => {
    expect(restanteMs(est, 160_000)).toBe(70_000);
    expect(relojWarmup(est, 160_000)).toEqual({ transcurrido: "2:40", restante: "~1:10", anterior: null });
  });

  test("superada la estimación deja de prometer y muestra la apertura anterior", () => {
    expect(restanteMs(est, 240_000)).toBeNull();
    expect(relojWarmup(est, 240_000)).toEqual({ transcurrido: "4:00", restante: null, anterior: "3:50" });
  });
});

describe("duracionFase", () => {
  test("terminada: lo que tomó", () => {
    expect(duracionFase({ status: "ready", elapsedMs: 31_000, ahoraMs: 0 })).toBe("0:31");
    expect(duracionFase({ status: "ready", elapsedMs: 300, ahoraMs: 0 })).toBe("0:01");
  });

  test("en curso: lo que lleva desde que empezó", () => {
    expect(duracionFase({ status: "running", inicioMs: 1_000, ahoraMs: 18_500 })).toBe("0:17");
    expect(duracionFase({ status: "running", ahoraMs: 18_500 })).toBe("");
  });

  test("en espera: la de la vez anterior, si la hay", () => {
    expect(duracionFase({ status: "pending", previaMs: 40_000, ahoraMs: 0 })).toBe("~0:40");
    expect(duracionFase({ status: "pending", ahoraMs: 0 })).toBe("");
  });
});

describe("tiempoWarmupReducer", () => {
  test("iniciar fija el reloj y olvida la apertura previa en curso", () => {
    const a = tiempoWarmupReducer(TIEMPO_WARMUP_INICIAL, { tipo: "fase", id: "x", ahoraMs: 5 });
    const b = tiempoWarmupReducer(a, { tipo: "iniciar", ahoraMs: 100 });
    expect(b).toEqual({ inicioMs: 100, estimacion: SIN_ESTIMACION, inicios: {} });
  });

  test("una fase guarda sólo su primer inicio", () => {
    let s = tiempoWarmupReducer(TIEMPO_WARMUP_INICIAL, { tipo: "fase", id: "f", ahoraMs: 10 });
    s = tiempoWarmupReducer(s, { tipo: "fase", id: "f", ahoraMs: 99 });
    expect(s.inicios).toEqual({ f: 10 });
  });

  test("una estimación vacía no pisa la que ya había", () => {
    const est = normalizarEstimacionWarmup({ ultima_apertura: { elapsed_ms: 9000 } });
    let s = tiempoWarmupReducer(TIEMPO_WARMUP_INICIAL, { tipo: "estimar", estimacion: est });
    s = tiempoWarmupReducer(s, { tipo: "estimar", estimacion: SIN_ESTIMACION });
    expect(s.estimacion.totalMs).toBe(9000);
  });
});
