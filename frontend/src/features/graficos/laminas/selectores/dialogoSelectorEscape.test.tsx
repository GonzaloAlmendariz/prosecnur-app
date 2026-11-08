// @vitest-environment happy-dom
// R9-19: en «Comparar», Escape vuelve a la lista y el selector sigue abierto; sin capa interna, Escape cierra.
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DialogoSelector } from "./DialogoSelector";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const pintar = (alEscape: (() => void) | undefined, onCerrar: () => void) => act(() => root.render(
  <DialogoSelector abierto onCerrar={onCerrar} panelProps={{ "data-pulso-panel": "selector" }} auditReady="f6-selector-lamina"
    antetitulo="Lámina 1" titulo="¿Qué quieres contar?" descripcion="" focoInicialRef={createRef<HTMLInputElement>()}
    pregunta={<p>pregunta</p>} galeria={<p>galeria</p>} detalle={<p>detalle</p>} alEscape={alEscape} />,
));

const escape = () => act(() => {
  const destino = document.querySelector<HTMLElement>(".pulso-f6-selector") ?? document.body;
  destino.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
});

describe("R9-19: Escape en el selector", () => {
  it("con una capa interna la cierra a ella y no al selector", () => {
    const alEscape = vi.fn();
    const onCerrar = vi.fn();
    pintar(alEscape, onCerrar);
    escape();
    expect(alEscape).toHaveBeenCalledTimes(1);
    expect(onCerrar).not.toHaveBeenCalled();
  });
  it("sin capa interna cierra el selector", () => {
    const onCerrar = vi.fn();
    pintar(undefined, onCerrar);
    escape();
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});
