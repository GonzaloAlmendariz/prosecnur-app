import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PruebaDeRegla } from "../../../../api/validacionAuditoria";
import { crearConteoPrevio, type EstadoDelConteo } from "./conteoPrevio";

function prueba(nCasos: number): PruebaDeRegla {
  return {
    estado: "evaluada",
    evaluada: true,
    motivo: null,
    base_vacia: false,
    filtro_previo: false,
    n_filas: 100,
    n_base: 100,
    n_casos: nCasos,
    proporcion: nCasos / 100,
    ejemplos: [],
  };
}

type Pedido = { cuerpo: Record<string, unknown>; signal: AbortSignal; resolver: (p: PruebaDeRegla) => void };

describe("conteo previo de una regla", () => {
  let pedidos: Pedido[];
  let estados: EstadoDelConteo[];
  let conteo: ReturnType<typeof crearConteoPrevio>;

  beforeEach(() => {
    vi.useFakeTimers();
    pedidos = [];
    estados = [];
    conteo = crearConteoPrevio({
      esperaMs: 500,
      alCambiar: (e) => estados.push(e),
      probar: (cuerpo, { signal }) =>
        new Promise<PruebaDeRegla>((resolver) => {
          pedidos.push({ cuerpo, signal, resolver });
        }),
    });
  });

  afterEach(() => {
    conteo.cerrar();
    vi.useRealTimers();
  });

  it("espera a que el borrador se quede quieto antes de pedir", () => {
    conteo.pedir({ min: "1" });
    conteo.pedir({ min: "12" });
    vi.advanceTimersByTime(499);
    expect(pedidos).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(pedidos.map((p) => p.cuerpo)).toEqual([{ min: "12" }]);
    expect(estados.at(-1)).toEqual({ fase: "contando" });
  });

  it("un borrador nuevo cancela el pedido anterior y descarta su respuesta", async () => {
    conteo.pedir({ min: "1" });
    vi.advanceTimersByTime(500);
    const primero = pedidos[0];
    conteo.pedir({ min: "2" });
    expect(primero.signal.aborted).toBe(true);
    vi.advanceTimersByTime(500);
    const segundo = pedidos[1];
    primero.resolver(prueba(99));
    segundo.resolver(prueba(4));
    await vi.runAllTimersAsync();
    const listos = estados.filter((e) => e.fase === "listo");
    expect(listos).toHaveLength(1);
    expect(listos[0]).toMatchObject({ fase: "listo", prueba: { n_casos: 4 } });
  });

  it("el mismo borrador no se vuelve a pedir", () => {
    conteo.pedir({ min: "1" });
    vi.advanceTimersByTime(500);
    conteo.pedir({ min: "1" });
    vi.advanceTimersByTime(500);
    expect(pedidos).toHaveLength(1);
  });

  it("una regla incompleta deja el conteo sin regla y corta lo que estaba en vuelo", () => {
    conteo.pedir({ min: "1" });
    vi.advanceTimersByTime(500);
    conteo.pedir(null);
    expect(pedidos[0].signal.aborted).toBe(true);
    expect(estados.at(-1)).toEqual({ fase: "sin-regla" });
  });

  it("cerrar el panel corta el pedido y no avisa nada más", async () => {
    conteo.pedir({ min: "1" });
    vi.advanceTimersByTime(500);
    conteo.cerrar();
    expect(pedidos[0].signal.aborted).toBe(true);
    const antes = estados.length;
    pedidos[0].resolver(prueba(3));
    await vi.runAllTimersAsync();
    expect(estados).toHaveLength(antes);
  });
});
