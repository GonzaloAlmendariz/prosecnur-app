// @vitest-environment happy-dom
// Ítem 4 de la oleada I2: la tira de lados con su asa (flechas), el clic en el central y «Negativo 21%, Positivo 64%»
// del reparto que se ve, también antes de soltar. Sin detalle, los tres controles de siempre.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DetalleCifras, PedidoCifrasDetalleLote } from "../../../../api/graficosCifras";
import { detalle, fila, lados } from "../cifrasInspector/fixturaDetalle.test-utils";

const lote = vi.hoisted(() => vi.fn());
vi.mock("../../../../api/graficosCifras", async (original) => ({ ...(await original<object>()), apiGraficosCifrasDetalleLote: lote }));
vi.mock("../useRotulosCortos", () => ({ useRotulosCortos: () => undefined }));

import { olvidarDetalles } from "../cifrasInspector/cacheDetalle";
import { ESPERA_DETALLE_MS } from "../cifrasInspector/useDetalleCifras";
import { ESPERA_CIFRA_MS } from "../reglaPreguntas/useCifraEnVivo";
import { LadosEscala } from "./LadosEscala";

const NIVELES = ["Muy malo", "Malo", "Regular", "Bueno", "Muy bueno"];
const VAL = [10, 11, 15, 30, 34];
/** El motor simulado: los lados con el reparto pedido (k negativas, neutro partido si toca). */
function porArgs(args: Readonly<Record<string, unknown>>): DetalleCifras {
  const k = typeof args.n_negativas === "number" ? args.n_negativas : 2;
  const neg = VAL.slice(0, k).reduce((a, b) => a + b, 0);
  const pos = VAL.slice(k).reduce((a, b) => a + b, 0);
  const cats = NIVELES.map((c, i) => ({ clave: c, valor: VAL[i], lado: i < k ? "neg" as const : "pos" as const }));
  return detalle(cats, { forma: "divergentes", filas: [fila("p1", cats, { lados: lados(neg, 0, pos) })] });
}
let sinDetalle = false;

let host: HTMLDivElement;
let root: Root;
const cambios: Record<string, unknown>[] = [];
const pintar = (args: Record<string, unknown>) => act(() => root.render(
  <LadosEscala id="l" graficador="p_barras_divergentes" scope="active" args={{ var: "p1", ...args }}
    onCambio={(p) => { cambios.push(p); }} respaldo={<span data-qa="respaldo">tres controles</span>} />,
));
const esperar = async (ms = ESPERA_DETALLE_MS) => {
  await act(async () => { vi.advanceTimersByTime(ms); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const cifra = () => host.querySelector('[data-qa="lados-cifra"]')?.textContent;
const asa = () => host.querySelector<HTMLElement>('[role="slider"]')!;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  olvidarDetalles();
  sinDetalle = false;
  cambios.length = 0;
  lote.mockReset();
  lote.mockImplementation(async (p: PedidoCifrasDetalleLote) => Object.fromEntries(p.laminas.map((l) => [l.id, {
    cifras: { tipo: "", cifras: [], avisos: [] }, error: null, detalle: sinDetalle ? null : porArgs(l.args),
  }])));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

describe("Lados de la escala", () => {
  it("la tira con sus lados y la cifra de cada uno", async () => {
    pintar({});
    // R7-7: mientras carga, la silueta de la tira; nunca los tres controles.
    expect(host.querySelector('[data-qa="lados-silueta"]')).not.toBeNull();
    expect(host.querySelector('[data-qa="respaldo"]')).toBeNull();
    await esperar();
    expect(host.querySelector('[data-qa="lados-silueta"]')).toBeNull();
    const niveles = [...host.querySelectorAll(".pulso-f6-lados-nivel")].map((e) => e.className.match(/is-(neg|neu|pos)/)?.[1]);
    expect(niveles).toEqual(["neg", "neg", "neu", "pos", "pos"]);
    expect(asa().getAttribute("aria-valuenow")).toBe("2");
    expect(cifra()).toBe("Negativo 21%, Positivo 79%");
  });
  it("con la flecha el asa se mueve y la cifra se pide antes de confirmar; al rato se guarda", async () => {
    pintar({});
    await esperar();
    act(() => { asa().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
    expect(asa().getAttribute("aria-valuenow")).toBe("3");
    expect(cifra()).toBe("Negativo 21%, Positivo 79%");
    expect(host.querySelector('[data-qa="lados-cifra"]')?.className).toContain("is-anterior");
    await esperar();
    expect(cifra()).toBe("Negativo 36%, Positivo 64%");
    expect(cambios).toEqual([]);
    await esperar(ESPERA_CIFRA_MS);
    expect(cambios).toEqual([{ n_negativas: 3, incluir_neutro: true, direccion_escala: "negativo_positivo" }]);
  });
  it("el clic en el central deja de partir el neutro; el botón de flechas invierte los lados", async () => {
    pintar({});
    await esperar();
    act(() => { host.querySelector<HTMLButtonElement>(".pulso-f6-lados-nivel.is-central")!.click(); });
    expect(cambios.at(-1)).toEqual({ n_negativas: 2, incluir_neutro: false, direccion_escala: "negativo_positivo" });
    act(() => { host.querySelector<HTMLButtonElement>('[aria-label="Invertir los lados"]')!.click(); });
    expect(cambios.at(-1)).toMatchObject({ direccion_escala: "positivo_negativo" });
  });
  it("sin detalle quedan los tres controles de siempre", async () => {
    sinDetalle = true;
    pintar({});
    await esperar();
    expect(host.querySelector('[data-qa="respaldo"]')).not.toBeNull();
    expect(host.querySelector('[data-qa="lados-silueta"]')).toBeNull();
    expect(host.querySelector('[role="slider"]')).toBeNull();
  });
});
