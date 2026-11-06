// @vitest-environment happy-dom
/**
 * L5b: Carga lanza los cuatro imports de plataforma por el importador único.
 * Sin red: lanzadores y poller del store van inyectados.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobSnapshot } from "../../../api/jobs";
import type { JobPollUpdate } from "../../../hooks/useJob";

vi.mock("../../../hooks/useJob", () => ({ iniciarJobPoll: vi.fn() }));

import { crearStorePlataforma } from "./usePlataformaStore";
import { exitoDe, useImportsDeCarga, type DesenlaceImportCarga, type UseImportsDeCarga } from "./useImportsDeCarga";

type OnUpdate = (update: JobPollUpdate<unknown>) => void;

function pollerManual() {
  const callbacks = new Map<string, OnUpdate>();
  const poll = vi.fn((jobId: string, onUpdate: OnUpdate) => {
    callbacks.set(jobId, onUpdate);
    return () => {};
  });
  const emitir = (jobId: string, snap: Partial<JobSnapshot<unknown>>) => {
    callbacks.get(jobId)?.({ snapshot: { id: jobId, kind: "carga", started_at: "", finished_at: null, has_file_result: false, result_filename: null, result_data: {}, error: {}, status: "running", ...snap } });
  };
  return { poll, emitir };
}

const peticion = { id: "a1", titulo: "Encuesta de hogares", alias: null, perfilId: "p1", baseUrl: "https://kf.kobotoolbox.org", baseNombre: "", incluirParciales: false };

describe("useImportsDeCarga", () => {
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

  it("cada camino va a su lanzador y la tarjeta muestra el que corre hasta su desenlace", async () => {
    const poller = pollerManual();
    const lanzadores = {
      surveymonkeyUnica: vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "s1", kind: "x" }),
      surveymonkeySeparada: vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "s2", kind: "x" }),
      koboUnica: vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "k1", kind: "x" }),
      koboSeparada: vi.fn().mockResolvedValue({ ok: true, async: true, job_id: "k2", kind: "x" }),
    };
    const store = crearStorePlataforma({ ...lanzadores, poll: poller.poll });
    const visto: { actual: UseImportsDeCarga | null } = { actual: null };
    const desenlaces: DesenlaceImportCarga[] = [];
    function Sonda() {
      visto.actual = useImportsDeCarga((d) => desenlaces.push(d), store);
      return null;
    }
    act(() => root.render(<Sonda />));
    expect(visto.actual?.activo).toBeNull();

    await act(async () => { await visto.actual?.lanzar("kobo", "unica", peticion); });
    expect(lanzadores.koboUnica).toHaveBeenCalledTimes(1);
    expect(lanzadores.koboSeparada).not.toHaveBeenCalled();
    expect(lanzadores.surveymonkeyUnica).not.toHaveBeenCalled();
    expect(visto.actual?.activo).toMatchObject({ proveedor: "kobo", estrategia: "unica" });
    expect(visto.actual?.jobEnCurso).toBe(true);

    act(() => poller.emitir("k1", { status: "done", result_data: { ok: true, estudio: { n_bases: 1, bases: {}, active_base: "principal" } } }));
    expect(visto.actual?.jobEnCurso).toBe(false);
    expect(visto.actual?.activo?.importacion.estado).toBe("terminado");
    expect(desenlaces).toHaveLength(1);
    expect(exitoDe(desenlaces[0].terminado)?.estudio).toMatchObject({ n_bases: 1 });

    await act(async () => { await visto.actual?.lanzar("surveymonkey", "separada", { ...peticion, baseUrl: "", baseNombre: "docentes" }); });
    expect(lanzadores.surveymonkeySeparada).toHaveBeenCalledTimes(1);
    expect(visto.actual?.activo).toMatchObject({ proveedor: "surveymonkey", estrategia: "separada" });
  });

  it("exitoDe no devuelve nada si el import falló o se canceló sin dejar datos", () => {
    const base = { clave: "kobo:unica" as const, proveedor: "kobo" as const, estrategia: "unica" as const, etiqueta: "x", jobId: "j", iniciadoEn: 0, terminadoEn: 1, notificado: false };
    expect(exitoDe({ ...base, resultado: { tipo: "cancelado" } })).toBeNull();
    expect(exitoDe({ ...base, resultado: { tipo: "error", codigo: null, titulo: "t", mensaje: "m" } })).toBeNull();
  });
});
