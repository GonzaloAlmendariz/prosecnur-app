/**
 * Un job de sync simulado: sin red ni credenciales. Comprueba que el store del
 * perfil recibe «paso N de M», que al terminar queda un recibo y que un fallo
 * también deja el suyo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jobs = vi.hoisted(() => ({ apiJobStatus: vi.fn() }));
const monitoreo = vi.hoisted(() => ({
  apiMonitoreoSync: vi.fn(),
  apiMonitoreoSheetsSyncAsync: vi.fn(),
  normalizeMonitoreoSheetsSyncResult: vi.fn((data: unknown) => data),
}));
vi.mock("../../../api/jobs", () => jobs);
vi.mock("../../../api/monitoreo", () => monitoreo);

import { useToasterStore } from "../../../components/toasterStore";
import { ejecutarActualizacion, type LanzadorDeActualizacion, type ProgresoDelStore } from "./ejecutarActualizacion";

function storeSimulado() {
  const reportes: ProgresoDelStore[] = [];
  const eventos: string[] = [];
  return {
    reportes,
    eventos,
    acciones: {
      start: (p: ProgresoDelStore) => { eventos.push("start"); reportes.push(p); },
      report: (p: ProgresoDelStore) => { reportes.push(p); },
      finish: () => { eventos.push("finish"); },
    },
  };
}

const snapshot = (status: string, progress: Record<string, unknown>, result_data: unknown = {}) => ({
  id: "j1", kind: "monitoreo.sync", status, started_at: "", finished_at: null,
  has_file_result: false, result_filename: null, result_data, progress, error: {},
});

beforeEach(() => {
  vi.useFakeTimers();
  useToasterStore.getState().limpiar();
  monitoreo.apiMonitoreoSync.mockResolvedValue({ ok: true, job_id: "j1", kind: "monitoreo.sync" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Actualizar con un job simulado", () => {
  it("reporta paso N de M, relee el estado y deja el recibo", async () => {
    jobs.apiJobStatus
      .mockResolvedValueOnce(snapshot("running", { phase: "sheets_fetch", percent: 20, step: 1, steps: 3 }))
      .mockResolvedValueOnce(snapshot("running", { phase: "kobo_fetch", percent: 50, step: 2, steps: 3 }))
      .mockResolvedValueOnce(snapshot("running", { phase: "save", percent: 96 }))
      .mockResolvedValueOnce(snapshot("done", { phase: "done", percent: 100 }, {
        sync_summary: { a: { source_label: "Universo", mode: "full", rows: 12 }, b: { source_label: "Kobo", mode: "incremental", rows: 4 } },
        errors: [],
      }));
    const store = storeSimulado();
    const recargar = vi.fn().mockResolvedValue(undefined);
    const corrida = ejecutarActualizacion({ tipo: "sync", modo: "advance", fuentes: ["a", "b"] }, { acciones: store.acciones, recargar });
    await vi.advanceTimersByTimeAsync(5000);
    await corrida;

    expect(monitoreo.apiMonitoreoSync).toHaveBeenCalledWith(undefined, ["a", "b"], { syncMode: "advance" });
    const pasos = store.reportes.filter((r) => r.paso != null).map((r) => `${r.paso}/${r.pasos}`);
    expect(pasos).toEqual(["1/3", "2/3", "2/3", "2/3"]);
    expect(store.reportes.every((r) => r.mode === "advance")).toBe(true);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(store.eventos).toEqual(["start", "finish"]);
    const [recibo] = useToasterStore.getState().toasts;
    expect(recibo).toMatchObject({ tono: "exito", mensaje: "Actualizado", detalle: "Universo: 12 leídas · Kobo: 4 nuevas · Recalculado" });
  });

  it("un job que falla deja un recibo de error y avisa a la vista", async () => {
    jobs.apiJobStatus.mockResolvedValueOnce({ ...snapshot("error", { phase: "kobo_fetch" }), error: "Token vencido" });
    const store = storeSimulado();
    const alFallar = vi.fn();
    const corrida = ejecutarActualizacion({ tipo: "sync", modo: "full", fuentes: ["a"] }, { acciones: store.acciones, recargar: vi.fn(), alFallar });
    await vi.advanceTimersByTimeAsync(2000);
    await corrida;
    expect(alFallar).toHaveBeenCalledWith("Token vencido");
    expect(useToasterStore.getState().toasts[0]).toMatchObject({ tono: "error", mensaje: "No se pudo actualizar", detalle: "Token vencido" });
    expect(store.eventos).toEqual(["start", "finish"]);
  });

  it("Recalcular no lanza ningún job", async () => {
    const store = storeSimulado();
    const recargar = vi.fn().mockResolvedValue(undefined);
    await ejecutarActualizacion({ tipo: "recalcular" }, { acciones: store.acciones, recargar });
    expect(monitoreo.apiMonitoreoSync).not.toHaveBeenCalled();
    expect(monitoreo.apiMonitoreoSheetsSyncAsync).not.toHaveBeenCalled();
    expect(useToasterStore.getState().toasts[0]).toMatchObject({ mensaje: "Tablero recalculado" });
  });

  it("al salir del módulo el poll se corta sin recibo de fallo", async () => {
    const store = storeSimulado();
    const corrida = ejecutarActualizacion({ tipo: "sync", modo: "full", fuentes: ["a"] }, { acciones: store.acciones, recargar: vi.fn(), cancelado: () => true });
    await vi.advanceTimersByTimeAsync(1000);
    await corrida;
    expect(useToasterStore.getState().toasts).toHaveLength(0);
    expect(store.eventos).toEqual(["start", "finish"]);
  });

  it("un perfil inyecta su lanzamiento y el recibo sale de lo que devuelve", async () => {
    const lanzar = vi.fn<LanzadorDeActualizacion>(async (_peticion, { reportar }) => {
      reportar({ percent: 30, phase: "propio", message: "Paso propio", paso: 1, pasos: 2 });
      reportar({ percent: 70, phase: "propio", message: "Otro paso", paso: 2, pasos: 2 });
      return { tipo: "sync", resultado: { sync_summary: [{ source_label: "Ocurrencias", mode: "full", rows: 7 }], errors: [] } };
    });
    const store = storeSimulado();
    const recargar = vi.fn().mockResolvedValue(undefined);
    const config = {};
    await ejecutarActualizacion({ tipo: "sync", modo: "advance", fuentes: ["k", "o"] }, {
      acciones: store.acciones,
      recargar,
      lanzar,
      config,
    });
    expect(lanzar).toHaveBeenCalledTimes(1);
    expect(lanzar.mock.calls[0][0]).toEqual({ tipo: "sync", modo: "advance", fuentes: ["k", "o"] });
    expect(lanzar.mock.calls[0][1].config).toBe(config);
    expect(monitoreo.apiMonitoreoSync).not.toHaveBeenCalled();
    expect(store.reportes.filter((r) => r.paso != null).map((r) => `${r.paso}/${r.pasos}`)).toEqual(["1/2", "2/2"]);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(useToasterStore.getState().toasts[0]).toMatchObject({ tono: "exito", mensaje: "Actualizado", detalle: "Ocurrencias: 7 leídas · Recalculado" });
  });

  it("Recalcular no pasa por el lanzamiento inyectado", async () => {
    const lanzar = vi.fn<LanzadorDeActualizacion>();
    const store = storeSimulado();
    await ejecutarActualizacion({ tipo: "recalcular" }, { acciones: store.acciones, recargar: vi.fn().mockResolvedValue(undefined), lanzar });
    expect(lanzar).not.toHaveBeenCalled();
  });
});
