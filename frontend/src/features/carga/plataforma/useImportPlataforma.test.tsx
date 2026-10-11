// @vitest-environment happy-dom
/**
 * Import de plataforma como job: store con poll de vida de módulo +
 * hook que lo retoma tras desmontarse. Sin red: el módulo de API y el poller
 * de useJob van mockeados; el store de prueba recibe un poller manual.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobSnapshot } from "../../../api/jobs";
import type { JobPollUpdate } from "../../../hooks/useJob";

const apiMocks = vi.hoisted(() => ({
  smSeparada: vi.fn(),
  koboSeparada: vi.fn(),
  smUnica: vi.fn(),
  koboUnica: vi.fn(),
  cancel: vi.fn(),
  poll: vi.fn(),
}));

vi.mock("../../../api/cargaPlataforma", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../api/cargaPlataforma")>();
  return {
    ...real,
    apiCargaImportSurveyMonkeySeparadaAsync: apiMocks.smSeparada,
    apiCargaImportKoboSeparadaAsync: apiMocks.koboSeparada,
  };
});
vi.mock("../../../api/xlsformEditor", () => ({
  apiCargaImportSurveyMonkeyAsync: apiMocks.smUnica,
  apiCargaImportKoboAsync: apiMocks.koboUnica,
}));
vi.mock("../../../api/jobs", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../api/jobs")>();
  return { ...real, apiJobCancel: apiMocks.cancel };
});
vi.mock("../../../hooks/useJob", () => ({ iniciarJobPoll: apiMocks.poll }));

import { crearStorePlataforma, usePlataformaStore } from "./usePlataformaStore";
import { useImportPlataforma, type UseImportPlataforma } from "./useImportPlataforma";
import type { PeticionImport } from "./modeloPlataforma";

type OnUpdate = (update: JobPollUpdate<unknown>) => void;

/** Poller manual: guarda el callback por job y permite emitir snapshots. */
function pollerManual() {
  const callbacks = new Map<string, OnUpdate>();
  const detenidos: string[] = [];
  const poll = vi.fn((jobId: string, onUpdate: OnUpdate) => {
    callbacks.set(jobId, onUpdate);
    return () => { detenidos.push(jobId); };
  });
  const emitir = (jobId: string, snap: Partial<JobSnapshot<unknown>>) => {
    const cb = callbacks.get(jobId);
    if (!cb) throw new Error(`sin poll para ${jobId}`);
    cb({ snapshot: { id: jobId, kind: "carga", started_at: "", finished_at: null, has_file_result: false, result_filename: null, result_data: {}, error: {}, status: "running", ...snap } });
  };
  return { poll, emitir, callbacks, detenidos };
}

const separadoOk = {
  ok: true,
  provider: "surveymonkey",
  strategy: "separate",
  base_name: "acogida",
  n_filas: 1900,
  n_columnas: 80,
  child_bases: [],
  n_bases: 2,
  estudio: { n_bases: 2, bases: {}, nombre: null, max_bases: 10 },
};

const peticionSm: PeticionImport = {
  proveedor: "surveymonkey",
  estrategia: "separada",
  id: "512",
  titulo: "Percepción comunidad de acogida",
  alias: null,
  perfilId: "pucp",
  baseUrl: "",
  baseNombre: "",
  incluirParciales: false,
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  Object.values(apiMocks).forEach((m) => m.mockReset());
});

describe("usePlataformaStore", () => {
  it("lanza con async por el endpoint separado y sigue el job hasta importado", async () => {
    const poller = pollerManual();
    const lanzador = vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "j1", kind: "carga_platform" });
    const store = crearStorePlataforma({ surveymonkeySeparada: lanzador, poll: poller.poll, ahora: () => 1000 });

    const jobId = await store.getState().importar(peticionSm);
    expect(jobId).toBe("j1");
    expect(lanzador).toHaveBeenCalledWith({
      survey_id: "512",
      connection_profile_id: "pucp",
      source_alias: "Percepción comunidad de acogida",
      response_statuses: ["completed"],
      keep_missing_status: false,
    });
    expect(store.getState().vivos["surveymonkey:separada"]?.jobId).toBe("j1");

    poller.emitir("j1", { status: "running", progress: { phase: "fetch", current: 10, total: 100, percent: 40 } });
    expect(store.getState().vivos["surveymonkey:separada"]?.progreso).toMatchObject({ fase: 1, percent: 40 });

    poller.emitir("j1", { status: "done", result_data: separadoOk });
    const t = store.getState().terminados["surveymonkey:separada"];
    expect(t?.resultado).toMatchObject({ tipo: "importado", baseNombre: "acogida" });
    expect(store.getState().vivos).toEqual({});
    await flush();
    expect(poller.detenidos).toEqual(["j1"]);
  });

  it("cancelar llama POST cancel; si el job igual se cosecha done ⇒ cancelado-importado", async () => {
    const poller = pollerManual();
    const cancelarJob = vi.fn().mockResolvedValue({ ok: true });
    const store = crearStorePlataforma({
      surveymonkeySeparada: vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "j2", kind: "x" }),
      poll: poller.poll,
      cancelarJob,
    });
    await store.getState().importar(peticionSm);
    await store.getState().cancelar("surveymonkey:separada");
    expect(cancelarJob).toHaveBeenCalledWith("j2");
    expect(store.getState().vivos["surveymonkey:separada"]?.cancelSolicitado).toBe(true);

    poller.emitir("j2", { status: "done", result_data: separadoOk });
    expect(store.getState().terminados["surveymonkey:separada"]?.resultado.tipo).toBe("cancelado-importado");
  });

  it("cancelar antes de tener job_id cancela en cuanto llega", async () => {
    const poller = pollerManual();
    const cancelarJob = vi.fn().mockResolvedValue({ ok: true });
    let resolver: (v: unknown) => void = () => {};
    const store = crearStorePlataforma({
      koboSeparada: vi.fn(() => new Promise((r) => { resolver = r; })) as never,
      poll: poller.poll,
      cancelarJob,
    });
    const lanzado = store.getState().importar({ ...peticionSm, proveedor: "kobo", baseUrl: "https://kf.kobotoolbox.org" });
    await store.getState().cancelar("kobo:separada");
    expect(cancelarJob).not.toHaveBeenCalled();
    resolver({ ok: true, async: true, job_id: "j3", kind: "x" });
    await lanzado;
    expect(cancelarJob).toHaveBeenCalledWith("j3");
    poller.emitir("j3", { status: "cancelled" });
    expect(store.getState().terminados["kobo:separada"]?.resultado).toEqual({ tipo: "cancelado" });
  });

  it("sesión obsoleta y errores de lanzamiento quedan clasificados", async () => {
    const poller = pollerManual();
    const store = crearStorePlataforma({
      surveymonkeySeparada: vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "j4", kind: "x" }),
      koboSeparada: vi.fn().mockRejectedValue(Object.assign(new Error("Ya existe una base · E_BASE_DUP"), {})),
      poll: poller.poll,
    });
    await store.getState().importar(peticionSm);
    poller.emitir("j4", { status: "done", result_data: { ok: false, error: { code: "E_CARGA_JOB_STALE_SESSION", message: "x" } } });
    expect(store.getState().terminados["surveymonkey:separada"]?.resultado.tipo).toBe("sesion-obsoleta");

    expect(await store.getState().importar({ ...peticionSm, proveedor: "kobo" })).toBeNull();
    expect(store.getState().terminados["kobo:separada"]?.resultado).toMatchObject({ tipo: "error", codigo: "E_BASE_DUP", mensaje: "Ya existe una base" });
    expect(store.getState().terminados["kobo:separada"]?.jobId).toBeNull();
  });

  it("no lanza un segundo import mientras otro corre (E_CARGA_JOB_RUNNING local, sin pisar el vivo)", async () => {
    const poller = pollerManual();
    const kobo = vi.fn();
    const store = crearStorePlataforma({
      surveymonkeySeparada: vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "j5", kind: "x" }),
      koboUnica: kobo,
      poll: poller.poll,
    });
    await store.getState().importar(peticionSm);
    expect(await store.getState().importar({ ...peticionSm, proveedor: "kobo", estrategia: "unica" })).toBeNull();
    expect(kobo).not.toHaveBeenCalled();
    expect(store.getState().terminados["kobo:unica"]?.resultado).toMatchObject({ codigo: "E_CARGA_JOB_RUNNING" });
    expect(await store.getState().importar(peticionSm)).toBeNull();
    expect(store.getState().vivos["surveymonkey:separada"]?.jobId).toBe("j5");
  });

  it("la instancia de la app usa el módulo de API y el poller de useJob", async () => {
    apiMocks.smUnica.mockResolvedValue({ ok: true, async: true, job_id: "real1", kind: "x" });
    apiMocks.poll.mockReturnValue(() => {});
    await usePlataformaStore.getState().importar({ ...peticionSm, estrategia: "unica" });
    expect(apiMocks.smUnica).toHaveBeenCalledWith(expect.objectContaining({ survey_id: "512", title: peticionSm.titulo }));
    expect(apiMocks.poll).toHaveBeenCalledWith("real1", expect.any(Function));
    apiMocks.cancel.mockResolvedValue({ ok: true });
    await usePlataformaStore.getState().cancelar("surveymonkey:unica");
    expect(apiMocks.cancel).toHaveBeenCalledWith("real1");
    usePlataformaStore.getState().reiniciar();
  });
});

describe("useImportPlataforma", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("retoma el job vivo tras desmontarse y notifica el desenlace una sola vez al volver", async () => {
    const poller = pollerManual();
    const store = crearStorePlataforma({
      surveymonkeySeparada: vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "h1", kind: "x" }),
      koboSeparada: vi.fn(),
      poll: poller.poll,
    });
    const visto: { actual: UseImportPlataforma | null } = { actual: null };
    const onTerminado = vi.fn();

    function Sonda({ proveedor }: { proveedor: "surveymonkey" | "kobo" }) {
      visto.actual = useImportPlataforma({ proveedor, estrategia: "separada", store, onTerminado });
      return null;
    }

    act(() => root.render(<Sonda proveedor="surveymonkey" />));
    expect(visto.actual?.estado).toBe("inactivo");
    expect(visto.actual?.jobEnCurso).toBe(false);

    await act(async () => { await visto.actual?.importar(peticionSm); });
    expect(visto.actual?.estado).toBe("en-curso");
    expect(visto.actual?.jobEnCurso).toBe(true);

    // Cambio de pestaña: el componente se desmonta; el job sigue en el store.
    act(() => root.render(null));
    act(() => poller.emitir("h1", { status: "done", result_data: separadoOk }));
    expect(onTerminado).not.toHaveBeenCalled();

    // Ya terminó: otro proveedor no ve job en curso ni desenlace ajeno.
    act(() => root.render(<Sonda proveedor="kobo" />));
    expect(visto.actual?.estado).toBe("inactivo");
    expect(visto.actual?.jobEnCurso).toBe(false);

    act(() => root.render(<Sonda proveedor="surveymonkey" />));
    expect(visto.actual?.estado).toBe("terminado");
    expect(visto.actual?.terminado?.resultado).toMatchObject({ tipo: "importado", baseNombre: "acogida" });
    expect(onTerminado).toHaveBeenCalledTimes(1);

    act(() => root.render(<Sonda proveedor="surveymonkey" />));
    expect(onTerminado).toHaveBeenCalledTimes(1);

    act(() => visto.actual?.descartar());
    expect(visto.actual?.estado).toBe("inactivo");
  });

  it("jobEnCurso es global: otro proveedor lo ve mientras corre un import ajeno", async () => {
    const poller = pollerManual();
    const store = crearStorePlataforma({
      surveymonkeySeparada: vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "h2", kind: "x" }),
      poll: poller.poll,
    });
    await store.getState().importar(peticionSm);
    const visto: { actual: UseImportPlataforma | null } = { actual: null };
    function Sonda() {
      visto.actual = useImportPlataforma({ proveedor: "kobo", estrategia: "unica", store });
      return null;
    }
    act(() => root.render(<Sonda />));
    expect(visto.actual?.jobEnCurso).toBe(true);
    expect(visto.actual?.estado).toBe("inactivo");
  });
});
