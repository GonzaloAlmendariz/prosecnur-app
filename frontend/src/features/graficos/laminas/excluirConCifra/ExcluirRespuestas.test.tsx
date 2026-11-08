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
] } }) }));
vi.mock("../useRotulosCortos", () => ({ useRotulosCortos: () => undefined }));

import { olvidarDetalles } from "../cifrasInspector/cacheDetalle";
import { ESPERA_DETALLE_MS } from "../cifrasInspector/useDetalleCifras";
import { ExcluirRespuestas } from "./ExcluirRespuestas";

const TODAS = detalle([{ clave: "Sí", valor: 58 }, { clave: "No", valor: 34 }, { clave: "No sabe", valor: 8 }], { n: 412 });
const SIN_NS = detalle([{ clave: "Sí", valor: 63 }, { clave: "No", valor: 37 }], { n: 380 });
const SIN_NS_NI_NO = detalle([{ clave: "Sí", valor: 100 }], { n: 240 });

function porExcluidas(args: Readonly<Record<string, unknown>>): DetalleCifras {
  const ex = (args.excluir_opciones as string[] | undefined) ?? [];
  return ex.includes("2") ? SIN_NS_NI_NO : ex.includes("99") ? SIN_NS : TODAS;
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
    // La excluida dice el % que tendría sin exclusiones.
    expect(ficha("No sabe").textContent).toBe("No sabe8%");
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
