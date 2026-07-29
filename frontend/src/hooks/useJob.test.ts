// =============================================================================
// useJob.test.ts — endurecimiento del polling genérico de jobs (plan perf 2.4)
// =============================================================================
// El proyecto no usa @testing-library (tests puros de vitest en entorno node),
// así que testeamos `iniciarJobPoll`, el poller puro con dependencias
// inyectables que el hook `useJob` solo suscribe a estado React. Cobertura:
// error transitorio → recuperación; 404×M → job perdido; timeout → cancel
// best-effort + terminal; done normal intacto; stop() sin emisiones.
// =============================================================================

import { describe, expect, it, vi } from "vitest";
import { ApiError, type JobSnapshot } from "../api/client";
import { iniciarJobPoll, type JobPollUpdate } from "./useJob";

function snap(status: JobSnapshot["status"], extra: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "j1",
    kind: "test",
    status,
    started_at: "2026-07-29T00:00:00Z",
    finished_at: null,
    has_file_result: false,
    result_filename: null,
    result_data: {},
    error: {},
    ...extra,
  };
}

type TimerId = ReturnType<typeof setTimeout>;

/**
 * Scheduler falso: reloj virtual + cola de timers. `avanzar(ms)` ejecuta en
 * orden los timers vencidos drenando microtasks entre uno y otro (los polls
 * son async), sin timers reales.
 */
function crearScheduler() {
  let t = 0;
  let seq = 1;
  const tareas = new Map<number, { at: number; fn: () => void }>();
  const drenar = async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  };
  return {
    drenar,
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      const id = seq;
      seq += 1;
      tareas.set(id, { at: t + ms, fn });
      return id as unknown as TimerId;
    },
    clearTimer: (id: TimerId) => {
      tareas.delete(id as unknown as number);
    },
    async avanzar(ms: number) {
      const objetivo = t + ms;
      for (;;) {
        const vencidas = [...tareas.entries()]
          .filter(([, x]) => x.at <= objetivo)
          .sort((a, b) => a[1].at - b[1].at);
        const siguiente = vencidas[0];
        if (!siguiente) break;
        const [id, tarea] = siguiente;
        tareas.delete(id);
        t = Math.max(t, tarea.at);
        tarea.fn();
        await drenar();
      }
      t = objetivo;
    },
    pendientes: () => tareas.size,
  };
}

/** Colector de updates para asertar la secuencia emitida por el poller. */
function colector<T = unknown>() {
  const updates: JobPollUpdate<T>[] = [];
  return {
    updates,
    onUpdate: (u: JobPollUpdate<T>) => {
      updates.push(u);
    },
    statuses: () => updates.filter((u) => u.snapshot).map((u) => u.snapshot!.status),
    failure: () => updates.find((u) => u.failure)?.failure ?? null,
    retries: () => updates.filter((u) => u.retrying === true).length,
  };
}

describe("iniciarJobPoll — done normal intacto", () => {
  it("emite snapshots running→done y deja de pollear al terminar", async () => {
    const sch = crearScheduler();
    const respuestas = [snap("running"), snap("running"), snap("done")];
    const status = vi.fn(async () => respuestas.shift() ?? snap("done"));
    const col = colector();

    iniciarJobPoll("j1", col.onUpdate, {
      status,
      cancel: vi.fn(async () => ({ ok: true })),
      now: sch.now,
      setTimer: sch.setTimer,
      clearTimer: sch.clearTimer,
    });
    await sch.drenar();

    expect(col.statuses()).toEqual(["running"]);
    await sch.avanzar(400);
    await sch.avanzar(400);
    expect(col.statuses()).toEqual(["running", "running", "done"]);
    expect(col.failure()).toBeNull();
    expect(sch.pendientes()).toBe(0);

    // Terminal de verdad: avanzar más tiempo no genera polls nuevos.
    await sch.avanzar(60_000);
    expect(status).toHaveBeenCalledTimes(3);
  });
});

describe("iniciarJobPoll — error transitorio", () => {
  it("reintenta con backoff y se recupera sin declarar error", async () => {
    const sch = crearScheduler();
    const respuestas: Array<() => JobSnapshot> = [
      () => {
        throw new Error("Failed to fetch");
      },
      () => {
        throw new Error("Failed to fetch");
      },
      () => snap("running"),
      () => snap("done"),
    ];
    const status = vi.fn(async () => (respuestas.shift() ?? (() => snap("done")))());
    const col = colector();

    iniciarJobPoll("j1", col.onUpdate, {
      status,
      cancel: vi.fn(async () => ({ ok: true })),
      now: sch.now,
      setTimer: sch.setTimer,
      clearTimer: sch.clearTimer,
    });
    await sch.drenar();

    // Dos fallos → dos avisos de reintento (backoff 1s, 2s), luego recuperación.
    expect(col.retries()).toBe(1);
    await sch.avanzar(1000);
    expect(col.retries()).toBe(2);
    await sch.avanzar(2000);
    expect(col.statuses()).toEqual(["running"]);
    // La recuperación apaga el aviso de reintento por el mismo canal.
    expect(col.updates.at(-1)).toMatchObject({ retrying: false });
    await sch.avanzar(400);
    expect(col.statuses()).toEqual(["running", "done"]);
    expect(col.failure()).toBeNull();
  });

  it("declara terminal 'unreachable' tras N errores consecutivos, con el detalle original", async () => {
    const sch = crearScheduler();
    const status = vi.fn(async (): Promise<JobSnapshot> => {
      throw new Error("Failed to fetch");
    });
    const col = colector();

    iniciarJobPoll("j1", col.onUpdate, {
      status,
      cancel: vi.fn(async () => ({ ok: true })),
      now: sch.now,
      setTimer: sch.setTimer,
      clearTimer: sch.clearTimer,
      maxTransientErrors: 3,
    });
    await sch.drenar();
    await sch.avanzar(10_000);

    expect(status).toHaveBeenCalledTimes(3);
    expect(col.failure()).toMatchObject({ kind: "unreachable" });
    expect(col.failure()?.message).toContain("Failed to fetch");
    expect(sch.pendientes()).toBe(0);
  });
});

describe("iniciarJobPoll — 404 consecutivos (backend reiniciado)", () => {
  it("corta con terminal 'lost' tras M 404 seguidos", async () => {
    const sch = crearScheduler();
    const status = vi.fn(async (): Promise<JobSnapshot> => {
      throw new ApiError("E_JOB_NOT_FOUND", "Job j1 not found");
    });
    const col = colector();

    iniciarJobPoll("j1", col.onUpdate, {
      status,
      cancel: vi.fn(async () => ({ ok: true })),
      now: sch.now,
      setTimer: sch.setTimer,
      clearTimer: sch.clearTimer,
      maxNotFound: 3,
    });
    await sch.drenar();
    await sch.avanzar(10_000);

    expect(status).toHaveBeenCalledTimes(3);
    expect(col.failure()).toMatchObject({ kind: "lost" });
    expect(col.failure()?.message).toMatch(/ya no existe/);
    expect(sch.pendientes()).toBe(0);
  });

  it("un poll exitoso resetea el contador de 404", async () => {
    const sch = crearScheduler();
    const respuestas: Array<() => JobSnapshot> = [
      () => {
        throw new ApiError("E_JOB_NOT_FOUND", "Job j1 not found");
      },
      () => {
        throw new ApiError("E_JOB_NOT_FOUND", "Job j1 not found");
      },
      () => snap("running"),
      () => {
        throw new ApiError("E_JOB_NOT_FOUND", "Job j1 not found");
      },
      () => snap("done"),
    ];
    const status = vi.fn(async () => (respuestas.shift() ?? (() => snap("done")))());
    const col = colector();

    iniciarJobPoll("j1", col.onUpdate, {
      status,
      cancel: vi.fn(async () => ({ ok: true })),
      now: sch.now,
      setTimer: sch.setTimer,
      clearTimer: sch.clearTimer,
      maxNotFound: 3,
    });
    await sch.drenar();
    await sch.avanzar(30_000);

    expect(col.failure()).toBeNull();
    expect(col.statuses()).toEqual(["running", "done"]);
  });
});

describe("iniciarJobPoll — timeout global", () => {
  it("al vencer pide cancelar el job (best-effort) y emite terminal 'timeout'", async () => {
    const sch = crearScheduler();
    const status = vi.fn(async () => snap("running"));
    const cancel = vi.fn(async () => ({ ok: true }));
    const col = colector();

    iniciarJobPoll("j1", col.onUpdate, {
      status,
      cancel,
      now: sch.now,
      setTimer: sch.setTimer,
      clearTimer: sch.clearTimer,
      timeoutMs: 5000,
    });
    await sch.drenar();
    await sch.avanzar(6000);

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith("j1");
    expect(col.failure()).toMatchObject({ kind: "timeout" });
    expect(col.failure()?.message).toMatch(/minutos de espera/);
    expect(sch.pendientes()).toBe(0);
  });

  it("el terminal sale aunque el cancel best-effort falle", async () => {
    const sch = crearScheduler();
    const col = colector();

    iniciarJobPoll("j1", col.onUpdate, {
      status: async () => snap("running"),
      cancel: async () => {
        throw new Error("cancel caído");
      },
      now: sch.now,
      setTimer: sch.setTimer,
      clearTimer: sch.clearTimer,
      timeoutMs: 5000,
    });
    await sch.drenar();
    await sch.avanzar(6000);

    expect(col.failure()).toMatchObject({ kind: "timeout" });
  });
});

describe("iniciarJobPoll — stop()", () => {
  it("tras stop no pollea ni emite nada más", async () => {
    const sch = crearScheduler();
    const status = vi.fn(async () => snap("running"));
    const col = colector();

    const stop = iniciarJobPoll("j1", col.onUpdate, {
      status,
      cancel: vi.fn(async () => ({ ok: true })),
      now: sch.now,
      setTimer: sch.setTimer,
      clearTimer: sch.clearTimer,
    });
    await sch.drenar();
    expect(col.updates.length).toBe(1);

    stop();
    await sch.avanzar(60_000);
    expect(status).toHaveBeenCalledTimes(1);
    expect(col.updates.length).toBe(1);
  });
});
