import { describe, expect, it, vi } from "vitest";
import { ApiError, type JobSnapshot } from "../../../../api/client";
import {
  cmFormatElapsed,
  esJobNoEncontrado,
  esperarJob,
  JobCancelledError,
} from "../jobPolling";

function snap(status: JobSnapshot["status"], extra: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "j1",
    kind: "test",
    status,
    started_at: "2026-07-16T00:00:00Z",
    finished_at: null,
    has_file_result: false,
    result_filename: null,
    result_data: {},
    error: {},
    ...extra,
  };
}

/** Reloj falso: `sleep` avanza el tiempo, sin timers reales. */
function reloj() {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

describe("esperarJob — F6", () => {
  it("timeout: cancela el job en el backend (best-effort) antes de abandonar", async () => {
    const { now, sleep } = reloj();
    const cancel = vi.fn(async () => ({ ok: true }));
    await expect(
      esperarJob("j1", "Comparando métodos", {
        status: async () => snap("running"),
        cancel,
        now,
        sleep,
        timeoutMs: 10_000,
        intervalMs: 1_000,
      }),
    ).rejects.toThrow(/superó los .* minutos .* cancelar el job/i);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith("j1");
  });

  it("timeout: el error sale aunque el cancel best-effort falle", async () => {
    const { now, sleep } = reloj();
    await expect(
      esperarJob("j1", "Sorteo", {
        status: async () => snap("running"),
        cancel: async () => {
          throw new Error("cancel caído");
        },
        now,
        sleep,
        timeoutMs: 5_000,
        intervalMs: 1_000,
      }),
    ).rejects.toThrow(/superó los/);
  });

  it("404 persistente: corta tras N consecutivos con mensaje de backend reiniciado", async () => {
    const { now, sleep } = reloj();
    const status = vi.fn(async () => {
      throw new ApiError("E_JOB_NOT_FOUND", "Job j1 not found");
    });
    const cancel = vi.fn(async () => ({ ok: true }));
    await expect(
      esperarJob("j1", "Comparando métodos", {
        status,
        cancel,
        now,
        sleep,
        intervalMs: 1_000,
        maxNotFound: 5,
      }),
    ).rejects.toThrow(/el backend se reinició y el job ya no existe/);
    expect(status).toHaveBeenCalledTimes(5);
    // El job no existe: no hay nada que cancelar.
    expect(cancel).not.toHaveBeenCalled();
  });

  it("404 transitorio: el contador se resetea si el job vuelve a responder", async () => {
    const { now, sleep } = reloj();
    const respuestas: Array<() => JobSnapshot> = [
      () => {
        throw new ApiError("E_JOB_NOT_FOUND", "not found");
      },
      () => {
        throw new ApiError("E_JOB_NOT_FOUND", "not found");
      },
      () => snap("running"),
      () => {
        throw new ApiError("E_JOB_NOT_FOUND", "not found");
      },
      () => snap("done"),
    ];
    let i = 0;
    const resultado = await esperarJob("j1", "Sorteo", {
      status: async () => respuestas[Math.min(i++, respuestas.length - 1)](),
      cancel: async () => ({ ok: true }),
      now,
      sleep,
      intervalMs: 1_000,
      maxNotFound: 3,
    });
    expect(resultado.status).toBe("done");
  });

  it("cancelación pedida por el usuario → JobCancelledError (estado limpio, no error)", async () => {
    const { now, sleep } = reloj();
    await expect(
      esperarJob("j1", "Sorteo", {
        cancelRequested: () => true,
        status: async () => snap("running"),
        cancel: async () => ({ ok: true }),
        now,
        sleep,
      }),
    ).rejects.toBeInstanceOf(JobCancelledError);
  });

  it("status error → lanza con el mensaje real del worker; done → resuelve", async () => {
    const { now, sleep } = reloj();
    await expect(
      esperarJob("j1", "Sorteo", {
        status: async () => snap("error", { error: "se acabó la memoria del worker" }),
        cancel: async () => ({ ok: true }),
        now,
        sleep,
      }),
    ).rejects.toThrow(/se acabó la memoria del worker/);

    const ok = await esperarJob("j1", "Sorteo", {
      status: async () => snap("done"),
      cancel: async () => ({ ok: true }),
      now,
      sleep,
    });
    expect(ok.status).toBe("done");
  });

  it("reporta progreso con etapa y tiempo transcurrido", async () => {
    const { now, sleep } = reloj();
    let llamadas = 0;
    const progresos: string[] = [];
    await esperarJob("j1", "Comparando métodos", {
      status: async () =>
        llamadas++ === 0
          ? snap("running", { progress: { message: "corrida 5/500" } as JobSnapshot["progress"] })
          : snap("done"),
      cancel: async () => ({ ok: true }),
      onProgress: (texto) => progresos.push(texto),
      now,
      sleep,
      intervalMs: 1_500,
    });
    expect(progresos).toHaveLength(1);
    expect(progresos[0]).toContain("Comparando métodos");
    expect(progresos[0]).toContain("corrida 5/500");
    expect(progresos[0]).toContain("00:00");
  });
});

describe("esJobNoEncontrado", () => {
  it("reconoce E_JOB_NOT_FOUND y HTTP_404; ignora otros errores", () => {
    expect(esJobNoEncontrado(new ApiError("E_JOB_NOT_FOUND", "x"))).toBe(true);
    expect(esJobNoEncontrado(new ApiError("HTTP_404", "x"))).toBe(true);
    expect(esJobNoEncontrado(new ApiError("E_INTERNAL", "x"))).toBe(false);
    expect(esJobNoEncontrado(new Error("network"))).toBe(false);
  });
});

describe("cmFormatElapsed", () => {
  it("formatea mm:ss", () => {
    expect(cmFormatElapsed(0)).toBe("00:00");
    expect(cmFormatElapsed(61_000)).toBe("01:01");
    expect(cmFormatElapsed(-5)).toBe("00:00");
  });
});
