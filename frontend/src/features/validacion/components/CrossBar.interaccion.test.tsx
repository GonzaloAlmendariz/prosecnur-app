// @vitest-environment happy-dom
// CrossBar monta el Popover del kit (L1): el botón abre el selector de cruce,
// elegir una variable llama a onChange (Escape y click fuera los prueba el Popover).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import CrossBar from "./CrossBar";
import type { ExploradorSeccion } from "../types";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

const SECCIONES: ExploradorSeccion[] = [{
  nombre: "General",
  variables: [
    { name: "edad", label: "Edad", tipo: "num", n_validos: 10, n_nulos: 0 },
    { name: "sexo", label: "Sexo", tipo: "so", n_validos: 10, n_nulos: 0 },
  ],
}];

test("abre el selector en el Popover del kit y elegir una variable llama a onChange", () => {
  const onChange = vi.fn();
  act(() => root.render(
    <CrossBar secciones={SECCIONES} selfVar="edad" selfSeccion="General" cruzar={null} onChange={onChange} />,
  ));
  const abrir = host.querySelector<HTMLButtonElement>("button[aria-haspopup='dialog']");
  expect(abrir).toBeTruthy();
  act(() => abrir!.click());
  const panel = document.querySelector<HTMLElement>(".pulso-popover.pulso-crossbar-popover");
  expect(panel).toBeTruthy();
  expect(panel?.getAttribute("role")).toBe("dialog");
  const opcion = Array.from(panel!.querySelectorAll("button")).find((b) => b.textContent?.includes("sexo"));
  expect(opcion).toBeTruthy();
  act(() => opcion!.click());
  expect(onChange).toHaveBeenCalledWith("sexo");
});
