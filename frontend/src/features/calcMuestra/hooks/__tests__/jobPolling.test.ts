import { describe, expect, it, vi } from "vitest";
import { ApiError, type JobSnapshot } from "../../../../api/client";
import {
  cmFormatElapsed,
  cmFraccionEsDelTotal,
  cmJobEta,
  cmJobFraccion,
  cmTextoProgreso,
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
  it("timeout: sólo se aplica si quien llama lo pide; por defecto NO mata el trabajo", async () => {
    // La conducta que Gonzalo decidió: comparar los métodos sobre un marco de
    // tamaño normal pasa de una hora, y el reloj no puede tirar ese trabajo.
    // Antes, sin `timeoutMs`, a los 30 minutos se cancelaba el job y se perdía.
    const { now, sleep } = reloj();
    const cancel = vi.fn(async () => ({ ok: true }));
    let llamadas = 0;
    const resultado = await esperarJob("j1", "Comparando métodos", {
      // Dos horas de trabajo a 5 s por vuelta, y recién entonces termina.
      status: async () => (llamadas++ < 1440 ? snap("running") : snap("done")),
      cancel,
      now,
      sleep,
      intervalMs: 5_000,
      intervalLargoMs: 5_000,
    });
    expect(resultado.status).toBe("done");
    expect(now()).toBeGreaterThan(2 * 60 * 60_000 - 60_000);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("el polling se espacia cuando el trabajo se hace largo", async () => {
    const esperas: number[] = [];
    let t = 0;
    let llamadas = 0;
    await esperarJob("j1", "Comparando métodos", {
      status: async () => (llamadas++ < 400 ? snap("running") : snap("done")),
      cancel: async () => ({ ok: true }),
      now: () => t,
      sleep: async (ms: number) => {
        esperas.push(ms);
        t += ms;
      },
      intervalMs: 1_500,
      intervalLargoMs: 5_000,
      espaciarTrasMs: 60_000,
    });
    expect(esperas[0]).toBe(1_500);
    expect(esperas[esperas.length - 1]).toBe(5_000);
    // Espaciar de verdad: si no lo hiciera, 400 vueltas a 1,5 s serían 600 s.
    expect(esperas.filter((ms) => ms === 5_000).length).toBeGreaterThan(300);
  });

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

describe("el contador es honesto con cómo vamos", () => {
  it("cmJobFraccion lee percent, y si no viene, current/total", () => {
    expect(cmJobFraccion(snap("running", { progress: { percent: 47 } as JobSnapshot["progress"] }))).toBeCloseTo(0.47);
    expect(cmJobFraccion(snap("running", { progress: { current: 240, total: 500 } as JobSnapshot["progress"] }))).toBeCloseTo(0.48);
    // Sin señal medible no se inventa una: null, y el texto no promete nada.
    expect(cmJobFraccion(snap("running", { progress: { message: "corrida 5" } as JobSnapshot["progress"] }))).toBeNull();
    expect(cmJobFraccion(snap("running", { progress: {} as JobSnapshot["progress"] }))).toBeNull();
    expect(cmJobFraccion(snap("running", { progress: { current: 3, total: 0 } as JobSnapshot["progress"] }))).toBeNull();
  });

  it("cmJobEta extrapola el ritmo, y calla mientras la estimación no valga nada", () => {
    // A la mitad en 10 min ⇒ faltan ~10 min.
    expect(cmJobEta(600_000, 0.5)).toBe(600_000);
    // Al 25 % en 10 min ⇒ faltan ~30.
    expect(cmJobEta(600_000, 0.25)).toBe(1_800_000);
    expect(cmJobEta(600_000, null)).toBeNull();
    // Arranque: la carga de datos distorsiona y daría un número absurdo.
    expect(cmJobEta(5_000, 0.01)).toBeNull();
    expect(cmJobEta(600_000, 0.005)).toBeNull();
    expect(cmJobEta(600_000, 1)).toBeNull();
  });

  it("la línea dice etapa, transcurrido, lo que falta y que se pasó de lo previsto", () => {
    // MUDADO el mismo día: sin declarar que la fracción es del TOTAL, el
    // tiempo restante se anuncia como de la etapa. Ver «el tiempo restante
    // dice DE QUÉ es» más abajo.
    const corto = cmTextoProgreso({
      label: "Comparando métodos",
      stage: "corrida 240/500",
      elapsedMs: 600_000,
      fraccion: 0.48,
      fraccionEsDelTotal: true,
    });
    expect(corto).toContain("Comparando métodos — corrida 240/500");
    expect(corto).toContain("10:00");
    expect(corto).toContain("faltan ~");
    expect(corto).not.toContain("sigue trabajando");

    const largo = cmTextoProgreso({
      label: "Comparando métodos",
      stage: null,
      elapsedMs: 40 * 60_000,
      fraccion: 0.5,
      fraccionEsDelTotal: true,
      avisoLargoMs: 30 * 60_000,
    });
    // Pasarse del tiempo previsto se DICE; ya no se mata el trabajo.
    expect(largo).toContain("más de 30 min, sigue trabajando");

    // Sin fracción declarada no se inventa un tiempo restante.
    const sinEta = cmTextoProgreso({ label: "Sorteo", stage: "preparando", elapsedMs: 600_000, fraccion: null });
    expect(sinEta).not.toContain("faltan");
  });

  it("esperarJob entrega esa línea al banner, con lo que falta", async () => {
    let t = 0;
    let llamadas = 0;
    const progresos: string[] = [];
    await esperarJob("j1", "Comparando métodos", {
      status: async () =>
        llamadas++ < 3
          ? snap("running", { progress: { phase: "comparar", percent: 25, message: "corrida 125/500" } as JobSnapshot["progress"] })
          : snap("done"),
      cancel: async () => ({ ok: true }),
      onProgress: (texto) => progresos.push(texto),
      now: () => t,
      sleep: async (ms: number) => {
        t += ms;
      },
      intervalMs: 60_000,
    });
    const ultimo = progresos[progresos.length - 1];
    expect(ultimo).toContain("corrida 125/500");
    expect(ultimo).toContain("faltan ~");
  });
});

describe("el tiempo restante dice DE QUÉ es", () => {
  // Defecto propio, encontrado en vivo el mismo día que se construyó el
  // contador: el comparador publica «corrida 8 de 17» DENTRO de cada método y
  // hay cuatro, así que extrapolar esa fracción da el fin del método. Un
  // «faltan ~00:48» al lado se lee como el fin de la comparación y subestima
  // por cuatro.
  it("una fase de etapa NO promete el final del trabajo", () => {
    const texto = cmTextoProgreso({
      label: "Comparando métodos",
      stage: "Sistemático por facultad: corrida 8 de 17",
      elapsedMs: 42_000,
      fraccion: 8 / 17,
      fraccionEsDelTotal: false,
    });
    expect(texto).toContain("en esta etapa");
    expect(texto).not.toMatch(/faltan ~/);
  });

  it("una fase que sí mide el total lo promete", () => {
    const texto = cmTextoProgreso({
      label: "Comparando métodos",
      stage: "Método 2 de 4",
      elapsedMs: 600_000,
      fraccion: 0.5,
      fraccionEsDelTotal: true,
    });
    expect(texto).toContain("faltan ~10:00");
    expect(texto).not.toContain("en esta etapa");
  });

  it("cmFraccionEsDelTotal reconoce las fases del trabajo entero", () => {
    const con = (phase: unknown) =>
      cmFraccionEsDelTotal(snap("running", { progress: { phase } as JobSnapshot["progress"] }));
    expect(con("comparar")).toBe(true);
    expect(con("seleccionar")).toBe(true);
    // Las de etapa: el motor las usa dentro de cada método.
    expect(con("simulacion")).toBe(false);
    expect(con("simulacion_mc")).toBe(false);
    // Ante lo desconocido se asume etapa: subestimar lo que falta es mejor
    // que prometer un final que no llega.
    expect(con("fase_de_2027")).toBe(false);
    expect(con(undefined)).toBe(false);
    expect(cmFraccionEsDelTotal(snap("running"))).toBe(false);
  });
});
