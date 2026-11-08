// @vitest-environment happy-dom
// Oleada I2: la caché del detalle (un lote por cambio, deduplicación por firma, cancelación) y el hook que conserva el
// valor anterior mientras llega el nuevo.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DetalleCifras, EntradaLoteDetalle, PedidoCifrasDetalleLote } from "../../../../api/graficosCifras";
import { detalle } from "./fixturaDetalle.test-utils";

const lote = vi.hoisted(() => vi.fn());
vi.mock("../../../../api/graficosCifras", async (original) => ({ ...(await original<object>()), apiGraficosCifrasDetalleLote: lote }));

import { detalleEnCache, firmaDetalle, olvidarDetalles, pedirDetalles, type PedidoDetalle } from "./cacheDetalle";
import { ESPERA_DETALLE_MS, useDetalleCifras, type EstadoDetalle, type VarianteDetalle } from "./useDetalleCifras";

const D1 = detalle([{ clave: "Sí", valor: 58 }], { n: 412 });
const D2 = detalle([{ clave: "Sí", valor: 63 }], { n: 380 });
const entrada = (d: DetalleCifras | null): EntradaLoteDetalle => ({ cifras: { tipo: "", cifras: [], avisos: [] }, error: null, detalle: d });

/** El lote simulado responde con el detalle que diga `responder` por args. */
function simular(responder: (args: Readonly<Record<string, unknown>>) => DetalleCifras | null) {
  lote.mockImplementation(async (p: PedidoCifrasDetalleLote) =>
    Object.fromEntries(p.laminas.map((l) => [l.id, entrada(responder(l.args))])));
}

const P = (args: Record<string, unknown>): PedidoDetalle => ({ graficador: "p_barras_categoricas", scope: "active", args });
const conFirma = (p: PedidoDetalle) => ({ firma: firmaDetalle(p), pedido: p });

beforeEach(() => { olvidarDetalles(); lote.mockReset(); });

describe("caché del detalle", () => {
  it("dos pedidos de la misma firma en vuelo hacen un solo lote; las firmas repetidas van una vez", async () => {
    simular(() => D1);
    const a = vi.fn(); const b = vi.fn();
    pedirDetalles([conFirma(P({ var: "p1" })), conFirma(P({ var: "p1" })), conFirma(P({ var: "p2" }))], a);
    pedirDetalles([conFirma(P({ var: "p1" }))], b);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(lote).toHaveBeenCalledTimes(1);
    expect((lote.mock.calls[0][0] as PedidoCifrasDetalleLote).laminas).toHaveLength(2);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledWith(firmaDetalle(P({ var: "p1" })), { detalle: D1, error: null });
  });
  it("lo recibido se reutiliza sin pedir; `detalle: null` también se guarda", async () => {
    simular(() => null);
    pedirDetalles([conFirma(P({ var: "p1" }))], () => undefined);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(detalleEnCache(firmaDetalle(P({ var: "p1" })))).toBeNull();
    const c = vi.fn();
    pedirDetalles([conFirma(P({ var: "p1" }))], c);
    await act(async () => { await Promise.resolve(); });
    expect(lote).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledWith(firmaDetalle(P({ var: "p1" })), { detalle: null, error: null });
  });
  it("se aborta sólo cuando lo sueltan todos", () => {
    let senal: AbortSignal | undefined;
    lote.mockImplementation((_p: unknown, r?: { signal?: AbortSignal }) => { senal = r?.signal; return new Promise(() => undefined); });
    const soltarA = pedirDetalles([conFirma(P({ var: "p1" }))], () => undefined);
    const soltarB = pedirDetalles([conFirma(P({ var: "p1" }))], () => undefined);
    soltarA();
    expect(senal?.aborted).toBe(false);
    soltarB();
    expect(senal?.aborted).toBe(true);
  });
  it("un error no se guarda: el próximo vuelve a pedir", async () => {
    lote.mockRejectedValueOnce(new Error("caído"));
    const a = vi.fn();
    pedirDetalles([conFirma(P({ var: "p1" }))], a);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(a.mock.calls[0][1].detalle).toBeNull();
    expect(detalleEnCache(firmaDetalle(P({ var: "p1" })))).toBeUndefined();
  });
});

describe("useDetalleCifras", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let visto: Readonly<Record<string, EstadoDetalle>> = {};
  function Prueba({ variantes, graficador = "p_barras_categoricas" }: { variantes: VarianteDetalle[]; graficador?: string }) {
    visto = useDetalleCifras(graficador, "active", variantes);
    return null;
  }
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    host = document.createElement("div");
    root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); });

  const esperar = async () => {
    await act(async () => { vi.advanceTimersByTime(ESPERA_DETALLE_MS); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  };

  it("pide con espera, y al cambiar de args conserva lo anterior atenuado hasta que llega lo nuevo", async () => {
    simular((args) => (args.excluir_opciones ? D2 : D1));
    act(() => root.render(<Prueba variantes={[{ clave: "actual", args: { var: "p1" } }]} />));
    expect(visto.actual).toEqual({ detalle: null, vigente: false, sinDetalle: false });
    expect(lote).not.toHaveBeenCalled();
    await esperar();
    expect(visto.actual).toEqual({ detalle: D1, vigente: true, sinDetalle: false });
    act(() => root.render(<Prueba variantes={[{ clave: "actual", args: { var: "p1", excluir_opciones: ["99"] } }]} />));
    expect(visto.actual).toEqual({ detalle: D1, vigente: false, sinDetalle: false });
    await esperar();
    expect(visto.actual).toEqual({ detalle: D2, vigente: true, sinDetalle: false });
    expect(lote).toHaveBeenCalledTimes(2);
  });
  it("varias variantes van en un solo lote; un graficador sin detalle no pide nada", async () => {
    simular(() => D1);
    act(() => root.render(<Prueba variantes={[{ clave: "a", args: { var: "p1" } }, { clave: "b", args: { var: "p2" } }]} />));
    await esperar();
    expect(lote).toHaveBeenCalledTimes(1);
    act(() => root.render(<Prueba graficador="p_pie" variantes={[{ clave: "a", args: { var: "p9" } }]} />));
    await esperar();
    expect(lote).toHaveBeenCalledTimes(1);
    expect(visto.a.sinDetalle).toBe(true);
  });
  it("un cambio rápido cancela el pedido anterior antes de salir", async () => {
    simular(() => D1);
    act(() => root.render(<Prueba variantes={[{ clave: "a", args: { var: "p1" } }]} />));
    act(() => root.render(<Prueba variantes={[{ clave: "a", args: { var: "p2" } }]} />));
    await esperar();
    expect(lote).toHaveBeenCalledTimes(1);
    expect((lote.mock.calls[0][0] as PedidoCifrasDetalleLote).laminas[0].args).toEqual({ var: "p2" });
  });
});
