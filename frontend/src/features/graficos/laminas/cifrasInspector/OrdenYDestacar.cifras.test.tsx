// @vitest-environment happy-dom
// Ítem 3 de la oleada I2: el % de cada fila de Orden y de cada ficha de Destacar, y «La más alta (Sí, 62%)». Un solo
// pedido para los dos (misma firma); sin detalle, sin cifra.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraficadorRef, GraficosCategorias } from "../../../../api/graficos";
import type { DetalleCifras, PedidoCifrasDetalleLote } from "../../../../api/graficosCifras";
import { detalle } from "./fixturaDetalle.test-utils";

const lote = vi.hoisted(() => vi.fn());
vi.mock("../../../../api/graficosCifras", async (original) => ({ ...(await original<object>()), apiGraficosCifrasDetalleLote: lote }));
const ESTADO = { updateSlotArgs: () => undefined, plan: { rotulos_cortos: undefined }, presets: {} };
vi.mock("../../store", () => ({ usePlanStore: (sel: (s: typeof ESTADO) => unknown) => sel(ESTADO) }));
// El store simulado no tiene `getState()`: la config del editor que manda el lote (R5-12) sale de aquí.
const CONFIG = vi.hoisted(() => ({ presets: { barras_categoricas: { decimales: 1 } } }));
vi.mock("../../configSnapshot", () => ({ buildGraficosConfigFromStore: () => CONFIG }));
vi.mock("../../useVariables", () => ({
  parseVarRef: (r: string) => ({ name: r, source: null }),
  useVariables: () => ({ variables: [{ name: "p1", source: "b1", choices: [{ name: "1", label: "Sí" }, { name: "2", label: "No" }] }] }),
}));
const CATS: GraficosCategorias = {
  var: "p1", base: "", pregunta: "", ordinal: false, tipo: "select_one", modo_recetario: "frecuencia",
  categorias: [{ codigo: "1", etiqueta: "Sí", n: 9, pct: 0.6, residual: false }, { codigo: "2", etiqueta: "No", n: 6, pct: 0.4, residual: false }],
  orden: { recetario: ["1", "2"], instrumento: ["1", "2"], frecuencia: ["1", "2"] }, avisos: [],
};
vi.mock("../useCategoriasGrafico", () => ({ useCategoriasGrafico: () => ({ fase: "lista", datos: CATS, reintentar: () => undefined }) }));

import { olvidarDetalles } from "./cacheDetalle";
import { ESPERA_DETALLE_MS } from "./useDetalleCifras";
import { DestacarRespuestas } from "../DestacarRespuestas";
import { OrdenCategoriasGrafico } from "../OrdenCategoriasGrafico";

const D = detalle([{ clave: "Sí", valor: 62 }, { clave: "No", valor: 38 }]);
const ARGS = { var: "p1", overrides: { resaltar_mayor: true } };
let respuesta: DetalleCifras | null = D;

let host: HTMLDivElement;
let root: Root;
const pintar = () => act(() => root.render(<>
  <OrdenCategoriasGrafico variable="b1$p1" graficador="p_barras_categoricas" args={ARGS} scope="active" onCambio={() => undefined} />
  <DestacarRespuestas slideId="s" slot="g" valor={{ graficador: "p_barras_categoricas", args: ARGS } as GraficadorRef} />
</>));
const esperar = async () => {
  await act(async () => { vi.advanceTimersByTime(ESPERA_DETALLE_MS); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const textos = (qa: string) => [...host.querySelectorAll(`[data-qa="${qa}"]`)].map((e) => e.textContent?.trim());

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  olvidarDetalles();
  respuesta = D;
  lote.mockReset();
  lote.mockImplementation(async (p: PedidoCifrasDetalleLote) => Object.fromEntries(p.laminas.map((l) => [l.id, {
    cifras: { tipo: "", cifras: [], avisos: [] }, error: null, detalle: respuesta,
  }])));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

describe("Orden y Destacar con su %", () => {
  it("cada fila y cada ficha con su %, y la más alta nombrada; los dos controles comparten un pedido", async () => {
    pintar();
    expect(textos("cifra-orden")).toEqual([]);
    await esperar();
    expect(textos("cifra-orden")).toEqual(["62%", "38%"]);
    expect(textos("cifra-ficha")).toEqual(["62%", "38%"]);
    expect(host.querySelector('[data-qa="resaltar-mayor"]')?.textContent).toBe("La más alta (Sí, 62%)");
    expect(lote).toHaveBeenCalledTimes(1);
    expect((lote.mock.calls[0][0] as PedidoCifrasDetalleLote).config).toBe(CONFIG);
  });
  it("R7-10: con un máximo de categorías, la que va a Otros dice «en Otros» en la lista de Orden", async () => {
    respuesta = detalle([{ clave: "Sí", valor: 62 }, { clave: "Otros", valor: 38 }]);
    act(() => root.render(<OrdenCategoriasGrafico variable="b1$p1" graficador="p_barras_categoricas" args={{ var: "p1", max_categorias: 1 }} scope="active" onCambio={() => undefined} />));
    await esperar();
    expect(textos("cifra-orden")).toEqual(["62%"]);
    expect(textos("orden-en-otros")).toEqual(["en Otros"]);
  });
  it("sin detalle quedan como hoy", async () => {
    respuesta = null;
    pintar();
    await esperar();
    expect(textos("cifra-orden")).toEqual([]);
    expect(host.querySelector('[data-qa="resaltar-mayor"]')?.textContent).toBe("La más alta");
  });
});
