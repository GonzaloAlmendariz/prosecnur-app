// @vitest-environment happy-dom
// «Agrupar en la lista» en la tarjeta: lee lo guardado, agrega y quita filas y escribe la lista con nombre del motor.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../useVariables", () => ({
  useVariables: () => ({ variables: [
    { name: "A6_1", label: "Distrito de Lima", source: "b1" },
    { name: "A6_2", label: "Distrito del Callao", source: "b1" },
  ] }),
  parseVarRef: (ref: string) => { const i = ref.lastIndexOf("$"); return i >= 0 ? { source: ref.slice(0, i), name: ref.slice(i + 1) } : { source: null, name: ref }; },
}));
const { AgruparLista } = await import("./AgruparLista");

let host: HTMLDivElement;
let root: Root;
let escrito: unknown[] = [];
const MAPA = { var: "A6_1", juntar: ["A6_2"] };

// Como el store: lo escrito vuelve como el valor guardado (mergeSlotArgsPatch borra el arg con `null`).
function Tarjeta({ inicial }: { inicial: unknown }) {
  const [valor, setValor] = useState(inicial);
  return <AgruparLista id="x" etiqueta={<span>Agrupar en la lista</span>} nota={null} valor={valor} args={MAPA}
    onCambio={(v) => { escrito.push(v); setValor(v ?? undefined); }} />;
}
function montar(valor: unknown) {
  act(() => root.render(<Tarjeta inicial={valor} />));
}
const botones = () => [...host.querySelectorAll("button")];
const ficha = (texto: string, fila = 0) =>
  [...host.querySelectorAll(".pulso-f6-criterio")][fila].querySelector<HTMLButtonElement>(`button[title="${texto}"], button[title*="${texto}"]`);
const pulsar = (b: Element | null | undefined) => act(() => { (b as HTMLButtonElement).click(); });
const escribir = (input: HTMLInputElement, texto: string) => act(() => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  set?.call(input, texto);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  escrito = [];
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("AgruparLista", () => {
  it("lee la lista con nombre guardada (ccss-011): rótulo y la pregunta del Callao marcada", () => {
    montar({ Callao: ["A6_2"] });
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("Callao");
    expect(ficha("Distrito del Callao")?.getAttribute("aria-pressed")).toBe("true");
    expect(ficha("Distrito de Lima")?.getAttribute("aria-pressed")).toBe("false");
    expect(host.textContent).not.toContain("A6_2");
    expect(escrito).toEqual([]);
  });
  it("agregar: rótulo y pregunta escriben `{ Callao: [\"A6_2\"] }`", () => {
    montar(null);
    pulsar(botones().find((b) => b.textContent?.includes("Agregar fila agrupada")));
    expect(escrito).toEqual([]);
    expect(host.textContent).toContain("Falta el rótulo y las preguntas: no sale.");
    escribir(host.querySelector<HTMLInputElement>("input")!, "Callao");
    pulsar(ficha("Distrito del Callao"));
    expect(escrito.at(-1)).toEqual({ Callao: ["A6_2"] });
  });
  it("una pregunta que ya suma en otra fila no se puede marcar en la segunda", () => {
    montar({ Callao: ["A6_2"] });
    pulsar(botones().find((b) => b.textContent?.includes("Agregar fila agrupada")));
    const ocupada = ficha("Ya suma en “Callao”", 1);
    expect(ocupada?.getAttribute("aria-disabled")).toBe("true");
    pulsar(ocupada);
    expect(escrito).toEqual([]);
  });
  it("quitar la fila borra el arg (null)", () => {
    montar({ Callao: ["A6_2"] });
    pulsar(host.querySelector('button[aria-label="Quitar la fila agrupada Callao"]'));
    expect(escrito).toEqual([null]);
    expect(host.querySelectorAll(".pulso-f6-criterio").length).toBe(0);
  });
});
