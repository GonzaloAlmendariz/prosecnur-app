import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../api/core";
import type { PreviewSlideResponse, Slide } from "../../../../api/graficos";
import type { JobSnapshot } from "../../../../api/jobs";
import type { JobPollUpdate } from "../../../../hooks/useJob";
import { crearCargaPreviewPorJob, esRutaInexistente, progresoDeJob, type DepsPreviewPorJob } from "./previewPorJob";

const slide = { id: "s-1", tipo: "p_slide_1_grafico", payload: {} } as unknown as Slide;
const respuesta = { ok: true, file_id: "f1", size: 10, type: "pptx", images: [] } as PreviewSlideResponse;

function snap(status: JobSnapshot["status"], extra: Partial<JobSnapshot<PreviewSlideResponse>> = {}): JobSnapshot<PreviewSlideResponse> {
  return { id: "j1", kind: "graficos.preview_slide", status, started_at: "", finished_at: null, has_file_result: false, result_filename: null, result_data: {}, error: {}, ...extra };
}

/** Poll controlable a mano: `emitir` empuja actualizaciones como lo haría iniciarJobPoll. */
function crearDeps(over: Partial<DepsPreviewPorJob> = {}) {
  let emitir: (u: JobPollUpdate<PreviewSlideResponse>) => void = () => undefined;
  const parar = vi.fn();
  const deps: DepsPreviewPorJob = {
    lanzar: vi.fn(async () => ({ ok: true as const, job_id: "j1", lote_id: "l1", kind: "graficos.preview_slide", total: 1, en_cache: 0, pendientes: 1, hash: "h", slide_id: "s-1" })),
    sincrono: vi.fn(async () => respuesta),
    poll: vi.fn((_id, onUpdate) => { emitir = onUpdate; return parar; }),
    cancelar: vi.fn(async () => ({ ok: true })),
    ...over,
  };
  return { deps, parar, emitir: (u: JobPollUpdate<PreviewSlideResponse>) => emitir(u) };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("crearCargaPreviewPorJob", () => {
  it("lanza el job, informa progreso y resuelve con result_data al done", async () => {
    const { deps, emitir, parar } = crearDeps();
    const progreso = vi.fn();
    const cargar = crearCargaPreviewPorJob(deps);
    const p = cargar({ slide, config: {}, options: { preview_partes: true }, signal: new AbortController().signal, onProgreso: progreso });
    await tick();
    emitir({ snapshot: snap("running", { progress: { phase: "running", current: 0, total: 1, message: "Lámina s-1 (1 de 1)" } }) });
    emitir({ snapshot: snap("done", { result_data: respuesta }) });
    await expect(p).resolves.toBe(respuesta);
    expect(deps.sincrono).not.toHaveBeenCalled();
    expect(progreso).toHaveBeenCalledWith({ mensaje: "Dibujando la lámina", porcentaje: null });
    expect(progreso).toHaveBeenLastCalledWith({ mensaje: "Listo", porcentaje: null });
    expect(parar).toHaveBeenCalled();
  });

  it("un error de dominio dentro de result_data se rechaza con su código", async () => {
    const { deps, emitir } = crearDeps();
    const p = crearCargaPreviewPorJob(deps)({ slide, config: {}, options: {}, signal: new AbortController().signal });
    await tick();
    emitir({ snapshot: snap("done", { result_data: { ok: false, error: { code: "E_PREVIEW_FAILED", status: 400, message: "No se pudo generar el preview: x" } } as unknown as PreviewSlideResponse }) });
    await expect(p).rejects.toMatchObject({ code: "E_PREVIEW_FAILED" });
  });

  it("status error y fallo del poll se rechazan con mensaje legible", async () => {
    const a = crearDeps();
    const pa = crearCargaPreviewPorJob(a.deps)({ slide, config: {}, options: {}, signal: new AbortController().signal });
    await tick();
    a.emitir({ snapshot: snap("error", { error: "worker murió" }) });
    await expect(pa).rejects.toThrow("No se pudo generar la vista previa: worker murió");

    const b = crearDeps();
    const pb = crearCargaPreviewPorJob(b.deps)({ slide, config: {}, options: {}, signal: new AbortController().signal });
    await tick();
    b.emitir({ failure: { kind: "lost", message: "El backend se reinició" } });
    await expect(pb).rejects.toThrow("El backend se reinició");
  });

  it("reemplazar (abortar) detiene el poll y pide cancelar el job", async () => {
    const { deps, emitir, parar } = crearDeps();
    const control = new AbortController();
    const p = crearCargaPreviewPorJob(deps)({ slide, config: {}, options: {}, signal: control.signal });
    await tick();
    control.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(parar).toHaveBeenCalled();
    expect(deps.cancelar).toHaveBeenCalledWith("j1");
    // Una respuesta tardía ya no resuelve nada.
    emitir({ snapshot: snap("done", { result_data: respuesta }) });
  });

  it("abortar mientras el POST viaja cancela el job que igual nació", async () => {
    const control = new AbortController();
    const { deps } = crearDeps({
      lanzar: vi.fn(async () => { control.abort(); return { ok: true as const, job_id: "j9", lote_id: "", kind: "", total: 1, en_cache: 0, pendientes: 1, hash: null, slide_id: null }; }),
    });
    await expect(crearCargaPreviewPorJob(deps)({ slide, config: {}, options: {}, signal: control.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(deps.cancelar).toHaveBeenCalledWith("j9");
    expect(deps.poll).not.toHaveBeenCalled();
  });

  it("si la ruta del job no existe (404) cae al síncrono y lo recuerda", async () => {
    const { deps } = crearDeps({ lanzar: vi.fn(async () => { throw new ApiError("E_NOT_FOUND", "Unknown API route"); }) });
    const cargar = crearCargaPreviewPorJob(deps);
    const signal = new AbortController().signal;
    await expect(cargar({ slide, config: { a: 1 }, options: { preview_partes: true }, signal })).resolves.toBe(respuesta);
    await expect(cargar({ slide, config: {}, options: {}, signal })).resolves.toBe(respuesta);
    expect(deps.lanzar).toHaveBeenCalledTimes(1);
    expect(deps.sincrono).toHaveBeenCalledTimes(2);
    expect(deps.sincrono).toHaveBeenCalledWith(slide, { a: 1 }, { preview_partes: true }, { signal });
  });

  it("otro error del POST (400 de validación) no cae al síncrono", async () => {
    const { deps } = crearDeps({ lanzar: vi.fn(async () => { throw new ApiError("E_BAD_SLIDE", "Lámina inválida"); }) });
    await expect(crearCargaPreviewPorJob(deps)({ slide, config: {}, options: {}, signal: new AbortController().signal })).rejects.toMatchObject({ code: "E_BAD_SLIDE" });
    expect(deps.sincrono).not.toHaveBeenCalled();
  });
});

describe("auxiliares", () => {
  it("esRutaInexistente reconoce los 404 de ruta", () => {
    expect(esRutaInexistente(new ApiError("HTTP_404", "x"))).toBe(true);
    expect(esRutaInexistente(new ApiError("E_NOT_FOUND", "x"))).toBe(true);
    expect(esRutaInexistente(new ApiError("E_JOB_NOT_FOUND", "x"))).toBe(false);
    expect(esRutaInexistente(new Error("404"))).toBe(false);
  });

  it("progresoDeJob tolera el {} de R y acota el porcentaje", () => {
    expect(progresoDeJob({})).toEqual({ mensaje: "Dibujando la lámina", porcentaje: null });
    expect(progresoDeJob(null)).toEqual({ mensaje: "Dibujando la lámina", porcentaje: null });
    expect(progresoDeJob({ phase: "done", percent: 140 })).toEqual({ mensaje: "Listo", porcentaje: 100 });
    expect(progresoDeJob({ current: 1, total: 4 })).toEqual({ mensaje: "Dibujando la lámina", porcentaje: 25 });
  });

  it("progresoDeJob no inventa un «0 %» fijo cuando el job es de una sola lámina (total ≤ 1)", () => {
    // Lo que escribe el worker durante todo el render de una lámina (job_progress_writer calcula percent = 0).
    expect(progresoDeJob({ phase: "running", current: 0, total: 1, percent: 0, message: "Lámina s-1 (1 de 1)" }))
      .toEqual({ mensaje: "Dibujando la lámina", porcentaje: null });
    expect(progresoDeJob({ phase: "running", current: 0, total: 0 })).toEqual({ mensaje: "Dibujando la lámina", porcentaje: null });
    // Con varias unidades sí hay avance; al terminar un job de una lámina tampoco se muestra número.
    expect(progresoDeJob({ phase: "running", current: 1, total: 2, percent: 50 })).toEqual({ mensaje: "Dibujando la lámina", porcentaje: 50 });
    expect(progresoDeJob({ phase: "done", current: 1, total: 1, percent: 100 })).toEqual({ mensaje: "Listo", porcentaje: null });
    expect(progresoDeJob({ phase: "done", current: 3, total: 3 })).toEqual({ mensaje: "Listo", porcentaje: 100 });
  });
});
