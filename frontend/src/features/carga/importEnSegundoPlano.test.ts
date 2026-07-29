import { describe, expect, it } from "vitest";
import { ApiError, type JobSnapshot } from "../../api/client";
import type { JobPollerDeps } from "../../hooks/useJob";
import {
  esperarResultadoImport,
  progresoDeJob,
  textoDeProgresoImport,
} from "./importEnSegundoPlano";

function snapshot(partial: Partial<JobSnapshot<unknown>>): JobSnapshot<unknown> {
  return {
    id: "job-1",
    kind: "carga.platform.kobo_import",
    status: "running",
    started_at: "2026-07-29T12:00:00Z",
    finished_at: null,
    has_file_result: false,
    result_filename: null,
    result_data: {},
    progress: {},
    error: {},
    ...partial,
  };
}

/** Deps del poller para tests: timers inmediatos y secuencia de snapshots. */
function depsConSecuencia(snapshots: Array<JobSnapshot<unknown>>): JobPollerDeps<unknown> {
  let index = 0;
  return {
    status: async () => {
      const snap = snapshots[Math.min(index, snapshots.length - 1)];
      index += 1;
      return snap;
    },
    cancel: async () => ({ ok: true }),
    setTimer: (fn: () => void) => setTimeout(fn, 0),
  };
}

describe("esperarResultadoImport", () => {
  it("resuelve con result_data cuando el job termina bien", async () => {
    const payload = { ok: true as const, provider: "kobo", n_bases: 2 };
    const result = await esperarResultadoImport<typeof payload>("job-1", {
      pollDeps: depsConSecuencia([snapshot({ status: "done", result_data: payload })]),
    });
    expect(result).toEqual(payload);
  });

  it("reporta el progreso de los ticks running y luego resuelve", async () => {
    const visto: string[] = [];
    const payload = { ok: true as const };
    const result = await esperarResultadoImport<typeof payload>("job-1", {
      onProgress: (p) => visto.push(`${p.phase}:${p.percent}:${p.message}`),
      pollDeps: depsConSecuencia([
        snapshot({ status: "running", progress: { phase: "fetch", percent: 40, message: "Kobo: descargando..." } }),
        snapshot({ status: "running", progress: { phase: "write", percent: 80, message: "Escribiendo base importada..." } }),
        snapshot({ status: "done", result_data: payload }),
      ]),
    });
    expect(result).toEqual(payload);
    expect(visto).toEqual([
      "fetch:40:Kobo: descargando...",
      "write:80:Escribiendo base importada...",
    ]);
  });

  it("relanza el error de dominio embebido en result_data como ApiError", async () => {
    const promesa = esperarResultadoImport("job-1", {
      pollDeps: depsConSecuencia([
        snapshot({
          status: "done",
          result_data: {
            ok: false,
            error: { code: "E_CARGA_JOB_STALE_SESSION", status: 409, message: "El proyecto abierto cambió durante el import; el resultado se descartó." },
          },
        }),
      ]),
    });
    await expect(promesa).rejects.toBeInstanceOf(ApiError);
    await expect(promesa).rejects.toMatchObject({ code: "E_CARGA_JOB_STALE_SESSION" });
  });

  it("rechaza con el mensaje del worker cuando el job termina en error", async () => {
    await expect(
      esperarResultadoImport("job-1", {
        pollDeps: depsConSecuencia([snapshot({ status: "error", error: "sin conexión con Kobo" })]),
      }),
    ).rejects.toThrow("sin conexión con Kobo");
  });

  it("rechaza cuando el job fue cancelado", async () => {
    await expect(
      esperarResultadoImport("job-1", {
        pollDeps: depsConSecuencia([snapshot({ status: "cancelled" })]),
      }),
    ).rejects.toThrow(/cancelado/);
  });

  it("rechaza con terminal del poll cuando el job se pierde (backend reiniciado)", async () => {
    const notFound = async () => {
      throw new ApiError("E_JOB_NOT_FOUND", "no existe");
    };
    await expect(
      esperarResultadoImport("job-1", {
        pollDeps: {
          status: notFound,
          cancel: async () => ({ ok: true }),
          setTimer: (fn: () => void) => setTimeout(fn, 0),
          maxNotFound: 2,
        },
      }),
    ).rejects.toThrow(/backend se reinició/);
  });
});

describe("textoDeProgresoImport", () => {
  it("compone etiqueta, mensaje y porcentaje para el busy existente", () => {
    expect(textoDeProgresoImport("Importando PDM", {
      percent: 42.4,
      phase: "fetch",
      message: "Kobo: descargando...",
    })).toBe("Importando PDM — Kobo: descargando... · 42%");
  });

  it("degrada con elegancia sin progreso o sin mensaje", () => {
    expect(textoDeProgresoImport("Importando PDM", null)).toBe("Importando PDM...");
    expect(textoDeProgresoImport("Importando PDM", { percent: 10, phase: "prepare", message: "" }))
      .toBe("Importando PDM... · 10%");
  });
});

describe("progresoDeJob", () => {
  it("normaliza percent fuera de rango y tolera el {} del unboxed-JSON", () => {
    expect(progresoDeJob({})).toBeNull();
    expect(progresoDeJob(null)).toBeNull();
    expect(progresoDeJob({ percent: 140, phase: "fetch", message: "x" }))
      .toEqual({ percent: 100, phase: "fetch", message: "x" });
    expect(progresoDeJob({ message: "solo mensaje" }))
      .toEqual({ percent: null, phase: "", message: "solo mensaje" });
  });
});
