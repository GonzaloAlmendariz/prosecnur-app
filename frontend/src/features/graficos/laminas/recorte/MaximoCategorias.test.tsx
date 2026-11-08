// @vitest-environment happy-dom
// Ítem 5 de la oleada I2: la lista completa con su línea de corte, «Fuera: … (7%)» o «Otros = 7%», en vivo al mover el
// slider (con espera y un lote); sin detalle, el control de siempre.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DetalleCifras, PedidoCifrasDetalleLote } from "../../../../api/graficosCifras";
import { detalle } from "../cifrasInspector/fixturaDetalle.test-utils";
import { clavesEnOtros, recorteDe, textoFuera } from "./modeloRecorte";

const lote = vi.hoisted(() => vi.fn());
vi.mock("../../../../api/graficosCifras", async (original) => ({ ...(await original<object>()), apiGraficosCifrasDetalleLote: lote }));

import { olvidarDetalles } from "../cifrasInspector/cacheDetalle";
import { ESPERA_DETALLE_MS } from "../cifrasInspector/useDetalleCifras";
import { ESPERA_CIFRA_MS } from "../reglaPreguntas/useCifraEnVivo";
import { MaximoCategorias } from "./MaximoCategorias";

const CATS = [{ clave: "Lima", valor: 40 }, { clave: "Cusco", valor: 30 }, { clave: "Piura", valor: 23 }, { clave: "Otro", valor: 4 }, { clave: "No sabe", valor: 3 }];
/** El motor simulado: conserva `max` (o todas) y, con agrupar, junta el resto en «Otros». */
function porArgs(args: Readonly<Record<string, unknown>>): DetalleCifras {
  const max = typeof args.max_categorias === "number" ? args.max_categorias : 12;
  if (max >= CATS.length) return detalle(CATS);
  const dentro = CATS.slice(0, max);
  const resto = CATS.slice(max).reduce((s, c) => s + c.valor, 0);
  return detalle(args.agrupar_resto_en_otros ? [...dentro, { clave: "Otros", valor: resto }] : dentro);
}
let sinDetalle = false;

let host: HTMLDivElement;
let root: Root;
const cambios: number[] = [];
const pintar = (args: Record<string, unknown>) => act(() => root.render(
  <MaximoCategorias id="m" rotulo="Máximo de categorías" graficador="p_barras_categoricas" scope="active" args={args} argName="max_categorias"
    valor={args.max_categorias} porDefecto={12} onCambio={(v) => { cambios.push(v); }} respaldo={<span data-qa="respaldo" />} />,
));
const esperar = async (ms = ESPERA_DETALLE_MS) => {
  await act(async () => { vi.advanceTimersByTime(ms); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const fuera = () => host.querySelector('[data-qa="recorte-fuera"]')?.textContent ?? null;
const filasFuera = () => [...host.querySelectorAll(".pulso-f6-recorte-fila.is-fuera .pulso-f6-recorte-nombre")].map((e) => e.textContent);

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

describe("Máximo de categorías con su línea de corte", () => {
  it("lo que queda fuera, con su suma; la lista entera y el corte en un solo lote", async () => {
    pintar({ var: "p1", max_categorias: 3 });
    await esperar();
    expect(lote).toHaveBeenCalledTimes(1);
    expect((lote.mock.calls[0][0] as PedidoCifrasDetalleLote).laminas).toHaveLength(2);
    expect(filasFuera()).toEqual(["Otro", "No sabe"]);
    expect(fuera()).toBe("Fuera: Otro, No sabe (7%)");
    expect(host.querySelector(".pulso-f6-recorte-linea")).not.toBeNull();
  });
  it("R7-10: con Otros, Otros es una fila sobre la línea y las que van a Otros se marcan debajo", async () => {
    pintar({ var: "p1", max_categorias: 3, agrupar_resto_en_otros: true });
    await esperar();
    const filas = [...host.querySelectorAll(".pulso-f6-recorte-fila")].map((e) => e.textContent);
    expect(filas).toEqual(["Lima40%", "Cusco30%", "Piura23%", "Otros7%", "Otroen Otros4%", "No sabeen Otros3%"]);
    // La línea va bajo Otros: cuatro filas visibles sobre ella.
    expect((host.querySelector(".pulso-f6-recorte-lista") as HTMLElement).style.getPropertyValue("--pulso-f6-corte")).toBe("4");
    expect(fuera()).toBeNull();
  });
  it("al mover el slider, la línea y la cifra siguen al borrador antes de guardar", async () => {
    pintar({ var: "p1", max_categorias: 3 });
    await esperar();
    const rango = host.querySelector<HTMLInputElement>('input[type="range"]')!;
    act(() => { rango.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })); });
    // Mientras llega: lo anterior, atenuado.
    expect(host.querySelector(".pulso-f6-recorte-lista")?.className).toContain("is-anterior");
    await esperar();
    expect(fuera()).toBe("Fuera: Piura, Otro, No sabe (30%)");
    await esperar(ESPERA_CIFRA_MS);
    expect(cambios).toEqual([2]);
  });
  it("sin detalle, el control de siempre", async () => {
    sinDetalle = true;
    pintar({ var: "p1", max_categorias: 3 });
    await esperar();
    expect(host.querySelector('[data-qa="respaldo"]')).not.toBeNull();
  });
  it("R7-10: las categorías que van a Otros, sin contar excluidas ni vacías; sin Otros en el detalle, ninguna", () => {
    const cats = ["Lima", "Cusco", "Piura", "Otro"].map((c) => ({ clave: c, rotulos: [c] }));
    const conOtros = detalle([{ clave: "Lima", valor: 40 }, { clave: "Otros", valor: 60 }]);
    expect([...clavesEnOtros(conOtros, cats, new Set(["Otro"]))]).toEqual(["Cusco", "Piura"]);
    expect(clavesEnOtros(detalle([{ clave: "Lima", valor: 40 }, { clave: "Cusco", valor: 60 }]), cats, new Set()).size).toBe(0);
  });
  it("nada fuera: sin línea ni frase", () => {
    const r = recorteDe(detalle(CATS), detalle(CATS));
    expect(r?.corte).toBe(5);
    expect(textoFuera(r)).toBeNull();
  });
});
