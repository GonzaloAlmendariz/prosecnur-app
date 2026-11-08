// @vitest-environment happy-dom
// Ítem 2 de la oleada I2: «Top Two Box 62%» junto al chip, en vivo al marcar o desmarcar; un lote para las dos cajas;
// sin detalle, nada.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PedidoCifrasDetalleLote } from "../../../../api/graficosCifras";
import { detalle, fila } from "../cifrasInspector/fixturaDetalle.test-utils";

const lote = vi.hoisted(() => vi.fn());
vi.mock("../../../../api/graficosCifras", async (original) => ({ ...(await original<object>()), apiGraficosCifrasDetalleLote: lote }));

import { olvidarDetalles } from "../cifrasInspector/cacheDetalle";
import { ESPERA_DETALLE_MS } from "../cifrasInspector/useDetalleCifras";
import { CifraTwoBox } from "./CifraTwoBox";
import { cifraCaja, textoTwoBox } from "./modeloCifraTwoBox";

const CATS = [{ clave: "Muy de acuerdo", valor: 34 }, { clave: "De acuerdo", valor: 28 }, { clave: "En desacuerdo", valor: 20 }, { clave: "Muy en desacuerdo", valor: 18 }];
const conCaja = (valor: number) => detalle(CATS, { forma: "escala", filas: [fila("p1", CATS, { caja: { valor, texto: `${valor}%`, rotulo: "Caja pedida", categorias: [], origen: "pedido" } })] });
const SUMA: Record<string, number> = Object.fromEntries(CATS.map((c) => [c.clave, c.valor]));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const pintar = (cajas: { top?: string[]; bottom?: string[] }, graficador = "p_barras_apiladas") =>
  act(() => root.render(<CifraTwoBox graficador={graficador} scope="active" args={{ var: "p1" }} cajas={cajas} />));
const esperar = async () => {
  await act(async () => { vi.advanceTimersByTime(ESPERA_DETALLE_MS); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const cifra = () => host.querySelector('[data-qa="twobox-cifra"]');

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  olvidarDetalles();
  lote.mockReset();
  lote.mockImplementation(async (p: PedidoCifrasDetalleLote) => Object.fromEntries(p.laminas.map((l) => [l.id, {
    cifras: { tipo: "", cifras: [], avisos: [] }, error: null, detalle: conCaja((l.caja ?? []).reduce((s, c) => s + (SUMA[c] ?? 0), 0)),
  }])));
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); });

describe("la cifra del Two Box", () => {
  it("las dos cajas en un solo lote, y al marcar otra categoría la cifra cambia (el anterior atenuado mientras llega)", async () => {
    pintar({ top: ["Muy de acuerdo", "De acuerdo"], bottom: ["Muy en desacuerdo"] });
    expect(cifra()?.getAttribute("aria-busy")).toBe("true");
    await esperar();
    expect(lote).toHaveBeenCalledTimes(1);
    expect(cifra()?.textContent).toBe("Top Two Box 62%, Bottom Two Box 18%");
    pintar({ top: ["Muy de acuerdo"], bottom: ["Muy en desacuerdo"] });
    expect(cifra()?.className).toContain("is-anterior");
    expect(cifra()?.textContent).toBe("Top Two Box 62%, Bottom Two Box 18%");
    await esperar();
    expect(cifra()?.textContent).toBe("Top Two Box 34%, Bottom Two Box 18%");
    // La de Bottom ya estaba en caché: sólo se pidió la nueva de Top.
    expect((lote.mock.calls[1][0] as PedidoCifrasDetalleLote).laminas).toHaveLength(1);
  });
  it("sin cajas o sin detalle no pinta nada", async () => {
    pintar({});
    expect(cifra()).toBeNull();
    lote.mockImplementation(async (p: PedidoCifrasDetalleLote) => Object.fromEntries(p.laminas.map((l) => [l.id, { cifras: { tipo: "", cifras: [], avisos: [] }, error: null, detalle: null }])));
    pintar({ top: ["Muy de acuerdo"] });
    await esperar();
    expect(cifra()).toBeNull();
    pintar({ top: ["Muy de acuerdo"] }, "p_pie");
    expect(cifra()).toBeNull();
  });
  it("con varias barras, el rango", () => {
    const d = detalle(CATS, { forma: "escala", filas: [38, 62].map((v, i) => fila(`p${i}`, CATS, { caja: { valor: v, texto: "", rotulo: "", categorias: [], origen: "pedido" } })) });
    expect(cifraCaja(d)).toBe("de 38% a 62%");
    expect(textoTwoBox([{ caja: "top", cifra: "62%" }, { caja: "bottom", cifra: null }])).toBe("Top Two Box 62%");
  });
});
