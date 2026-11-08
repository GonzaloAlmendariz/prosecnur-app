// @vitest-environment happy-dom
// Ítem 1 de la oleada I2 en pantalla: el % de cada ficha, «Base 412 → 380» junto al resumen y el efecto de la ficha
// bajo el cursor; sin detalle, las fichas quedan con su n.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DetalleCifras, PedidoCifrasDetalleLote } from "../../../../api/graficosCifras";
import { detalle } from "../cifrasInspector/fixturaDetalle.test-utils";

const lote = vi.hoisted(() => vi.fn());
vi.mock("../../../../api/graficosCifras", async (original) => ({ ...(await original<object>()), apiGraficosCifrasDetalleLote: lote }));
vi.mock("../useCategoriasGrafico", () => ({ useCategoriasGrafico: () => ({ fase: "lista", reintentar: () => undefined, datos: { categorias: [
  { codigo: "1", etiqueta: "Sí", n: 240, pct: 58, residual: false },
  { codigo: "2", etiqueta: "No", n: 140, pct: 34, residual: false },
  { codigo: "99", etiqueta: "No sabe", n: 32, pct: 8, residual: true },
  { codigo: "77", etiqueta: "Otro", n: 0, pct: 0, residual: false },
] } }) }));
vi.mock("../useRotulosCortos", () => ({ useRotulosCortos: () => undefined }));

import { olvidarDetalles } from "../cifrasInspector/cacheDetalle";
import { ESPERA_DETALLE_MS } from "../cifrasInspector/useDetalleCifras";
import { ExcluirRespuestas } from "./ExcluirRespuestas";

const decimales = { valor: 0 };
const TODAS_0 = detalle([{ clave: "Sí", valor: 58 }, { clave: "No", valor: 34 }, { clave: "No sabe", valor: 8 }], { n: 412 });
const TODAS_1 = detalle([{ clave: "Sí", valor: 58.25 }, { clave: "No", valor: 33.75 }, { clave: "No sabe", valor: 8 }], { n: 412, decimales: 1 });
const SIN_NS = detalle([{ clave: "Sí", valor: 63 }, { clave: "No", valor: 37 }], { n: 380 });
const SIN_NS_NI_NO = detalle([{ clave: "Sí", valor: 100 }], { n: 240 });

function porExcluidas(args: Readonly<Record<string, unknown>>): DetalleCifras {
  const ex = (args.excluir_opciones as string[] | undefined) ?? [];
  return ex.includes("2") ? SIN_NS_NI_NO : ex.includes("99") ? SIN_NS : decimales.valor ? TODAS_1 : TODAS_0;
}

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const pintar = (valor: string[], graficador = "p_barras_categoricas") => act(() => root.render(
  <ExcluirRespuestas id="x" etiqueta={<span>Excluir respuestas</span>} variable="b$p1" scope="active" graficador={graficador}
    args={{ var: "p1", excluir_opciones: valor }} argName="excluir_opciones" valor={valor} onCambio={() => undefined} textoRespaldo={<input />} />,
));
const esperar = async () => {
  await act(async () => { vi.advanceTimersByTime(ESPERA_DETALLE_MS); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const ficha = (t: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.startsWith(t))!;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  olvidarDetalles();
  decimales.valor = 0;
  lote.mockReset();
  lote.mockImplementation(async (p: PedidoCifrasDetalleLote) => Object.fromEntries(p.laminas.map((l) => [l.id, {
    cifras: { tipo: "", cifras: [], avisos: [] }, error: null, detalle: porExcluidas(l.args),
  }])));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

describe("Excluir respuestas con su cifra", () => {
  it("la base antes y después junto al resumen, y el % de cada ficha sobre la base nueva", async () => {
    pintar(["99"]);
    // Mientras carga, el control funciona y la cifra es una silueta.
    expect(host.querySelector('[data-qa="excluir-base"]')?.getAttribute("aria-busy")).toBe("true");
    await esperar();
    expect(host.querySelector('[data-qa="excluir-base"]')?.textContent).toBe("Base 412 → 380");
    expect(ficha("Sí").textContent).toBe("Sí63%");
    // R7-12: la excluida dice «Excluida» y la que no tiene casos, «0 casos».
    expect(ficha("No sabe").textContent).toBe("No sabeExcluida");
    expect(ficha("Otro").textContent).toBe("Otro0 casos");
    expect(lote).toHaveBeenCalledTimes(1);
  });
  it("al pasar el cursor por una ficha, una línea con el efecto de alternarla", async () => {
    pintar(["99"]);
    await esperar();
    act(() => { ficha("No").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    await esperar();
    expect(host.querySelector('[data-qa="excluir-efecto"]')?.textContent).toBe('Sin "No": Sí 63% → 100%');
    act(() => { ficha("No sabe").focus(); });
    await esperar();
    expect(host.querySelector('[data-qa="excluir-efecto"]')?.textContent).toBe('Con "No sabe": Sí 63% → 58%');
  });
  it("W2-B (C5): sin cursor la línea del efecto no se monta, y nunca muestra la cifra de la ficha anterior", async () => {
    pintar(["99"]);
    await esperar();
    expect(host.querySelector('[data-qa="excluir-efecto-linea"]')).toBeNull();
    // «No sabe» alternada es la variante «sin» (ya en caché): su efecto llega al momento.
    act(() => { ficha("No sabe").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    await esperar();
    expect(host.querySelector('[data-qa="excluir-efecto"]')?.textContent).toBe('Con "No sabe": Sí 63% → 58%');
    // Otra ficha: mientras llega su cifra, silueta; no «Sin "No": Sí 63% → 58%».
    act(() => { ficha("No").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    const esperando = host.querySelector('[data-qa="excluir-efecto"]');
    expect(esperando?.getAttribute("aria-busy")).toBe("true");
    expect(esperando?.textContent).toBe("");
    await esperar();
    expect(host.querySelector('[data-qa="excluir-efecto"]')?.textContent).toBe('Sin "No": Sí 63% → 100%');
    // Al salir, la línea se desmonta: no queda un renglón vacío reservado.
    act(() => { host.querySelector(".pulso-f6-cats")!.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })); });
    expect(host.querySelector('[data-qa="excluir-efecto-linea"]')).toBeNull();
  });
  it("R7-12: con un decimal en el gráfico, las fichas llevan el decimal de la lámina", async () => {
    decimales.valor = 1;
    pintar([]);
    await esperar();
    expect(ficha("Sí").textContent).toBe("Sí58.3%");
  });
  it("sin detalle, las fichas quedan con su n y no hay cifra", async () => {
    lote.mockImplementation(async (p: PedidoCifrasDetalleLote) => Object.fromEntries(p.laminas.map((l) => [l.id, {
      cifras: { tipo: "", cifras: [], avisos: [] }, error: null, detalle: null,
    }])));
    pintar(["99"]);
    await esperar();
    expect(host.querySelector('[data-qa="excluir-base"]')).toBeNull();
    expect(ficha("Sí").textContent).toBe("Sí240");
  });
});
