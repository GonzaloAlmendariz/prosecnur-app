import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../api/core";
import { normalizeMiniaturasLote, type MiniaturasLote } from "../../../../api/graficosMiniaturas";
import { esperaPoll, iniciarPollLote, MENSAJE_LOTE_INALCANZABLE, MENSAJE_LOTE_PERDIDO, type ActualizacionLote } from "./pollLote";

type TimerId = ReturnType<typeof setTimeout>;

/** Reloj virtual: `avanzar` corre los timers vencidos drenando microtasks entre uno y otro. */
function crearScheduler() {
  let t = 0;
  let seq = 1;
  const tareas = new Map<number, { at: number; fn: () => void }>();
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => { const id = seq++; tareas.set(id, { at: t + ms, fn }); return id as unknown as TimerId; },
    clearTimer: (id: TimerId) => { tareas.delete(id as unknown as number); },
    pendientes: () => tareas.size,
    async avanzar(ms: number) {
      const fin = t + ms;
      await flush();
      for (;;) {
        const sig = [...tareas.entries()].filter(([, v]) => v.at <= fin).sort((a, b) => a[1].at - b[1].at)[0];
        if (!sig) break;
        tareas.delete(sig[0]);
        t = sig[1].at;
        sig[1].fn();
        await flush();
      }
      t = fin;
    },
  };
}

const lote = (status: MiniaturasLote["status"]) => normalizeMiniaturasLote({ lote_id: "l1", job_id: "j1", status, laminas: [] });

describe("iniciarPollLote", () => {
  it("emite cada estado a medias y para al terminar", async () => {
    const s = crearScheduler();
    const respuestas = [lote("running"), lote("running"), lote("done")];
    const leer = vi.fn(async () => respuestas.shift() ?? lote("done"));
    const updates: ActualizacionLote[] = [];
    iniciarPollLote("l1", (u) => updates.push(u), { leer, ...s });
    await s.avanzar(5000);
    expect(updates.map((u) => (u.tipo === "estado" ? u.lote.status : u.tipo))).toEqual(["running", "running", "done"]);
    expect(s.pendientes()).toBe(0);
  });

  it("reintenta fallos transitorios y se rinde tras el máximo", async () => {
    const s = crearScheduler();
    const leer = vi.fn(async () => { throw new Error("red"); });
    const updates: ActualizacionLote[] = [];
    iniciarPollLote("l1", (u) => updates.push(u), { leer, ...s, maxTransitorios: 3 });
    await s.avanzar(60_000);
    expect(leer).toHaveBeenCalledTimes(3);
    expect(updates).toEqual([{ tipo: "fallo", mensaje: MENSAJE_LOTE_INALCANZABLE }]);
  });

  it("404 del lote repetido = backend reiniciado", async () => {
    const s = crearScheduler();
    const leer = vi.fn(async () => { throw new ApiError("E_MINIATURAS_LOTE_NO_EXISTE", "no"); });
    const updates: ActualizacionLote[] = [];
    iniciarPollLote("l1", (u) => updates.push(u), { leer, ...s, maxNoExiste: 2 });
    await s.avanzar(60_000);
    expect(updates).toEqual([{ tipo: "fallo", mensaje: MENSAJE_LOTE_PERDIDO }]);
  });

  it("parar no deja emisiones tardías", async () => {
    const s = crearScheduler();
    const leer = vi.fn(async () => lote("running"));
    const updates: ActualizacionLote[] = [];
    const parar = iniciarPollLote("l1", (u) => updates.push(u), { leer, ...s });
    await s.avanzar(0);
    parar();
    await s.avanzar(60_000);
    expect(updates).toHaveLength(1);
    expect(s.pendientes()).toBe(0);
  });

  it("la cadencia se espacia con el tiempo", () => {
    expect(esperaPoll(0)).toBeLessThan(esperaPoll(30_000));
    expect(esperaPoll(30_000)).toBeLessThan(esperaPoll(120_000));
  });
});
