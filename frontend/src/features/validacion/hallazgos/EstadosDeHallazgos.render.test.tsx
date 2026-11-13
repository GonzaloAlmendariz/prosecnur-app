// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DecisionEnCarga } from "./EstadosDeHallazgos";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("la Decisión mientras cargan los casos del hallazgo", () => {
  // Ítem 49 (QA30b): durante ~8 s la Decisión mostraba las opciones genéricas de un salto antes de las de la sección.
  test("muestra la carga y ninguna opción de tratamiento hasta tener el detalle", () => {
    act(() => root.render(<DecisionEnCarga />));
    expect(host.textContent).toContain("Decisión");
    expect(host.querySelector("[role='status'], [aria-busy='true']")).not.toBeNull();
    expect(host.querySelector("[role='radio'], [role='radiogroup']")).toBeNull();
    expect(host.textContent).not.toContain("Dejar como está");
    expect(host.textContent).not.toContain("Guardar");
  });
});
