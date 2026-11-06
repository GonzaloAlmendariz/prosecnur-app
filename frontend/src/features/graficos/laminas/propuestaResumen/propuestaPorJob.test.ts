// La propuesta del motor como job: done con la respuesta del síncrono, error de dominio como ApiError, caída al
// síncrono si la ruta del job no existe (y se recuerda), y abortar corta el poll y cancela el job.
import { describe, expect, test, vi } from "vitest";
import { ApiError } from "../../../../api/core";
import type { Slide } from "../../../../api/graficos";
import type { PropuestaResumen } from "../../../../api/graficosPropuesta";
import type { JobPollUpdate } from "../../../../hooks/useJob";
import { crearCargaPropuestaPorJob, type DepsPropuestaPorJob } from "./propuestaPorJob";

const slide = { id: "s-1", tipo: "p_slide_hallazgos", payload: {} } as unknown as Slide;
const RESPUESTA = {
  ok: true, slide_id: "s-1", tipo: "p_slide_hallazgos", modo: "resumen", base: "b1", avisos: [],
  capitulos: [{ titulo: "Vida universitaria", cifras: [{ var: "b3", fila: "1", pregunta: "¿Perteneces?", cifra: "44 %", texto: "", frase: "Voluntariado" }] }],
};
const snap = (status: "running" | "done" | "error" | "cancelled", result_data: unknown = {}, error = "") => ({
  snapshot: { id: "j1", kind: "graficos.propuesta_resumen", status, started_at: "", finished_at: null, has_file_result: false, result_filename: null, result_data, error } as JobPollUpdate<unknown>["snapshot"],
});

function deps(over: Partial<DepsPropuestaPorJob> = {}, updates: JobPollUpdate<unknown>[] = [snap("running"), snap("done", RESPUESTA)]) {
  const parar = vi.fn();
  const d: DepsPropuestaPorJob = {
    lanzar: vi.fn(async () => ({ jobId: "j1", slideId: "s-1", cache: false })),
    sincrono: vi.fn(async () => ({ slideId: "s-1", base: "", avisos: [], tipo: "p_slide_hallazgos", modo: "resumen", capitulos: [] }) as PropuestaResumen),
    poll: vi.fn((_id: string, on: (u: JobPollUpdate<unknown>) => void) => { for (const u of updates) on(u); return parar; }),
    cancelar: vi.fn(async () => undefined),
    ...over,
  };
  return { d, parar };
}

describe("crearCargaPropuestaPorJob", () => {
  test("done: result_data es la respuesta del síncrono, normalizada", async () => {
    const { d, parar } = deps();
    const r = await crearCargaPropuestaPorJob(d)({ slide, signal: new AbortController().signal });
    expect(r.tipo).toBe("p_slide_hallazgos");
    expect(r.capitulos[0].titulo).toBe("Vida universitaria");
    expect(d.sincrono).not.toHaveBeenCalled();
    expect(parar).toHaveBeenCalled();
  });

  test("con cache llega done al primer poll", async () => {
    const { d } = deps({ lanzar: vi.fn(async () => ({ jobId: "j1", slideId: "s-1", cache: true })) }, [snap("done", RESPUESTA)]);
    const r = await crearCargaPropuestaPorJob(d)({ slide, signal: new AbortController().signal });
    expect(r.capitulos).toHaveLength(1);
  });

  test("error de dominio en result_data se lanza como ApiError con su código", async () => {
    const { d } = deps({}, [snap("done", { ok: false, error: { code: "E_PROPUESTA_LAMINA_INVALIDA", status: 422, message: "Lámina inválida" } })]);
    const p = crearCargaPropuestaPorJob(d)({ slide, signal: new AbortController().signal });
    await expect(p).rejects.toBeInstanceOf(ApiError);
    await expect(p).rejects.toMatchObject({ code: "E_PROPUESTA_LAMINA_INVALIDA" });
  });

  test("sin la ruta del job cae al síncrono y lo recuerda", async () => {
    const lanzar = vi.fn(async () => { throw new ApiError("HTTP_404", "No existe"); });
    const { d } = deps({ lanzar });
    const cargar = crearCargaPropuestaPorJob(d);
    await cargar({ slide, signal: new AbortController().signal });
    await cargar({ slide, signal: new AbortController().signal });
    expect(lanzar).toHaveBeenCalledTimes(1);
    expect(d.sincrono).toHaveBeenCalledTimes(2);
  });

  test("reemplazado mientras se lanzaba: no pide el síncrono", async () => {
    const ctl = new AbortController();
    const lanzar = vi.fn(async () => { ctl.abort(); throw new ApiError("E_NOT_FOUND", "No existe"); });
    const { d } = deps({ lanzar });
    await expect(crearCargaPropuestaPorJob(d)({ slide, signal: ctl.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(d.sincrono).not.toHaveBeenCalled();
  });

  test("otro error del POST se propaga sin caer al síncrono", async () => {
    const { d } = deps({ lanzar: vi.fn(async () => { throw new ApiError("E_PROPUESTA_TIPO", "Tipo"); }) });
    await expect(crearCargaPropuestaPorJob(d)({ slide, signal: new AbortController().signal })).rejects.toMatchObject({ code: "E_PROPUESTA_TIPO" });
    expect(d.sincrono).not.toHaveBeenCalled();
  });

  test("abortar mientras corre corta el poll y cancela el job", async () => {
    const ctl = new AbortController();
    const { d, parar } = deps({}, [snap("running")]);
    const p = crearCargaPropuestaPorJob(d)({ slide, signal: ctl.signal });
    await Promise.resolve(); await Promise.resolve();
    ctl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(parar).toHaveBeenCalled();
    expect(d.cancelar).toHaveBeenCalledWith("j1");
  });
});
