/**
 * El «Actualizar ▾» de Territorial con jobs simulados: sin red ni Kobo. Las
 * ocurrencias de campo van primero por su endpoint, los pasos del job se corren
 * uno y lo que trajo cada fuente llega al recibo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jobs = vi.hoisted(() => ({ apiJobStatus: vi.fn() }));
const monitoreo = vi.hoisted(() => ({
  apiMonitoreoSync: vi.fn(),
  apiMonitoreoSheetsSyncAsync: vi.fn(),
  apiMonitoreoTerritorialOccurrencesSync: vi.fn(),
  normalizeMonitoreoSheetsSyncResult: vi.fn((data: unknown) => data),
}));
vi.mock("../../../../../api/jobs", () => jobs);
vi.mock("../../../../../api/monitoreo", () => monitoreo);

import { useToasterStore } from "../../../../../components/toasterStore";
import { ejecutarActualizacion, type ProgresoDelStore } from "../../../sync/ejecutarActualizacion";
import { crearLanzadorTerritorial } from "./lanzadorTerritorial";

const OCURRENCIAS = { id: "occ", source_id: "occ", asset_uid: "aOcc", etiqueta: "Ocurrencias de campo" };

function storeSimulado() {
  const reportes: ProgresoDelStore[] = [];
  const eventos: string[] = [];
  return {
    reportes,
    eventos,
    acciones: {
      start: (p: ProgresoDelStore) => { eventos.push("start"); reportes.push(p); },
      report: (p: ProgresoDelStore) => { eventos.push(`report:${p.phase}`); reportes.push(p); },
      finish: () => { eventos.push("finish"); },
    },
  };
}

const snapshot = (status: string, progress: Record<string, unknown>, result_data: unknown = {}) => ({
  id: "j1", kind: "monitoreo.sync", status, started_at: "", finished_at: null,
  has_file_result: false, result_filename: null, result_data, progress, error: {},
});

const pasos = (reportes: ProgresoDelStore[]) => reportes.filter((r) => r.paso != null).map((r) => `${r.paso}/${r.pasos}`);

beforeEach(() => {
  vi.useFakeTimers();
  useToasterStore.getState().limpiar();
  monitoreo.apiMonitoreoSync.mockResolvedValue({ ok: true, job_id: "j1", kind: "monitoreo.sync" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Actualizar territorial", () => {
  it("el cuerpo trae primero las ocurrencias, luego el Kobo de la fase, y corre los pasos del job", async () => {
    const orden: string[] = [];
    monitoreo.apiMonitoreoTerritorialOccurrencesSync.mockImplementation(async () => {
      orden.push("ocurrencias");
      return { ok: true, synced_at: "", n_rows: 57 };
    });
    monitoreo.apiMonitoreoSync.mockImplementation(async () => {
      orden.push("kobo");
      return { ok: true, job_id: "j1", kind: "monitoreo.sync" };
    });
    jobs.apiJobStatus
      .mockResolvedValueOnce(snapshot("running", { phase: "kobo_fetch", percent: 40, step: 1, steps: 2 }))
      .mockResolvedValueOnce(snapshot("running", { phase: "snapshot", percent: 82, step: 2, steps: 2 }))
      .mockResolvedValueOnce(snapshot("done", { phase: "done", percent: 100 }, {
        sync_summary: { kobo_campo: { source_label: "Kobo campo", mode: "incremental", rows: 12 } },
        errors: [],
      }));
    const store = storeSimulado();
    const recargar = vi.fn().mockResolvedValue(undefined);
    const config = {};
    const corrida = ejecutarActualizacion(
      { tipo: "sync", modo: "advance", fuentes: ["kobo_campo", "occ"] },
      { acciones: store.acciones, recargar, config, lanzar: crearLanzadorTerritorial(OCURRENCIAS) },
    );
    await vi.advanceTimersByTimeAsync(5000);
    await corrida;

    expect(orden).toEqual(["ocurrencias", "kobo"]);
    expect(monitoreo.apiMonitoreoTerritorialOccurrencesSync).toHaveBeenCalledWith({ source_id: "occ", asset_uid: "aOcc" });
    // Las ocurrencias no van al job: el router las descarta de /api/monitoreo/sync.
    expect(monitoreo.apiMonitoreoSync).toHaveBeenCalledWith(config, ["kobo_campo"], { syncMode: "advance" });
    expect(pasos(store.reportes)).toEqual(["1/3", "1/3", "2/3", "3/3", "3/3"]);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(useToasterStore.getState().toasts[0]).toMatchObject({
      tono: "exito",
      mensaje: "Actualizado",
      detalle: "Ocurrencias de campo: 57 leídas · Kobo campo: 12 nuevas · Recalculado",
    });
  });

  it("si las ocurrencias fallan, el Kobo se trae igual y el recibo dice «en parte»", async () => {
    monitoreo.apiMonitoreoTerritorialOccurrencesSync.mockRejectedValue(new Error("Sin token Kobo"));
    jobs.apiJobStatus.mockResolvedValueOnce(snapshot("done", { phase: "done", percent: 100, step: 2, steps: 2 }, {
      sync_summary: { kobo_campo: { source_label: "Kobo campo", mode: "incremental", rows: 0 } },
      errors: [],
    }));
    const store = storeSimulado();
    const corrida = ejecutarActualizacion(
      { tipo: "sync", modo: "advance", fuentes: ["kobo_campo", "occ"] },
      { acciones: store.acciones, recargar: vi.fn().mockResolvedValue(undefined), lanzar: crearLanzadorTerritorial(OCURRENCIAS) },
    );
    await vi.advanceTimersByTimeAsync(2000);
    await corrida;
    expect(monitoreo.apiMonitoreoSync).toHaveBeenCalledTimes(1);
    expect(useToasterStore.getState().toasts[0]).toMatchObject({
      tono: "aviso",
      mensaje: "Actualizado en parte",
      detalle: "Kobo campo: sin nuevas · Ocurrencias de campo: falló · Recalculado",
    });
  });

  it("las ocurrencias solas, desde el menú, no lanzan ningún job", async () => {
    monitoreo.apiMonitoreoTerritorialOccurrencesSync.mockResolvedValue({ ok: true, synced_at: "", n_rows: 3 });
    const store = storeSimulado();
    await ejecutarActualizacion(
      { tipo: "sync", modo: "full", fuentes: ["occ"] },
      { acciones: store.acciones, recargar: vi.fn().mockResolvedValue(undefined), lanzar: crearLanzadorTerritorial(OCURRENCIAS) },
    );
    expect(monitoreo.apiMonitoreoSync).not.toHaveBeenCalled();
    expect(pasos(store.reportes)).toEqual(["1/1"]);
    expect(useToasterStore.getState().toasts[0]).toMatchObject({ detalle: "Ocurrencias de campo: 3 leídas · Recalculado" });
  });

  it("sin ocurrencias declaradas, el Kobo y la hoja de ruta van por el camino común", async () => {
    jobs.apiJobStatus.mockResolvedValueOnce(snapshot("done", { phase: "done", step: 2, steps: 2 }, { sync_summary: {}, errors: [] }));
    const store = storeSimulado();
    const corrida = ejecutarActualizacion(
      { tipo: "sync", modo: "full", fuentes: ["kobo_campo"] },
      { acciones: store.acciones, recargar: vi.fn().mockResolvedValue(undefined), lanzar: crearLanzadorTerritorial(null) },
    );
    await vi.advanceTimersByTimeAsync(2000);
    await corrida;
    expect(monitoreo.apiMonitoreoSync).toHaveBeenCalledWith(undefined, ["kobo_campo"], { syncMode: "full" });
    expect(monitoreo.apiMonitoreoTerritorialOccurrencesSync).not.toHaveBeenCalled();
    expect(pasos(store.reportes)).toEqual(["2/2"]);

    monitoreo.apiMonitoreoSheetsSyncAsync.mockResolvedValue({ ok: true, job_id: "j2" });
    jobs.apiJobStatus.mockResolvedValueOnce(snapshot("done", { phase: "done" }, { n_rows: 40 }));
    const hojas = ejecutarActualizacion(
      { tipo: "hojas", fuentes: ["ruta"] },
      { acciones: store.acciones, recargar: vi.fn().mockResolvedValue(undefined), lanzar: crearLanzadorTerritorial(OCURRENCIAS) },
    );
    await vi.advanceTimersByTimeAsync(2000);
    await hojas;
    expect(monitoreo.apiMonitoreoSheetsSyncAsync).toHaveBeenCalledWith(["ruta"]);
    expect(useToasterStore.getState().toasts.map((t) => t.detalle)).toContain("1 hoja de Sheets: 40 registros · Recalculado");
  });
});
