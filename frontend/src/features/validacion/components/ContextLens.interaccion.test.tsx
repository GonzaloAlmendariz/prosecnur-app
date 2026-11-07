// @vitest-environment happy-dom
// ContextLens sobre las primitivas del kit (L1): lateral = Sideover, centrado =
// Dialog; misma API para sus tres consumidores. Fija nombre, ancho, pestañas
// internas y Escape.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ContextLens from "./ContextLens";

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

const TABS = [
  { id: "a", label: "Resumen", content: <p>contenido A</p> },
  { id: "b", label: "Detalle", content: <p>contenido B</p> },
];

function montar(placement: "right" | "center", onClose = vi.fn()) {
  act(() => root.render(
    <MemoryRouter initialEntries={["/validacion"]}>
      <ContextLens open onClose={onClose} title="Regla R1" subtitle="Una línea" tabs={TABS} variant="wide" placement={placement} />
    </MemoryRouter>,
  ));
  return { dialogo: document.querySelector<HTMLElement>("[role='dialog']"), onClose };
}

test("lateral: es el Sideover del kit, con su ancho y sus pestañas internas", () => {
  const { dialogo } = montar("right");
  expect(dialogo?.className).toContain("pulso-sideover");
  expect(dialogo?.className).toContain("pulso-lens--wide");
  expect(dialogo?.textContent).toContain("Regla R1");
  expect(dialogo?.textContent).toContain("contenido A");
  const detalle = Array.from(dialogo?.querySelectorAll("[role='tab']") ?? []).find((b) => b.textContent?.includes("Detalle")) as HTMLButtonElement;
  act(() => detalle.click());
  expect(dialogo?.textContent).toContain("contenido B");
});

test("centrado: es el Dialog del kit", () => {
  const { dialogo } = montar("center");
  expect(dialogo?.className).toContain("pulso-dialog");
});

test("Escape lo cierra por onClose", () => {
  const { dialogo, onClose } = montar("right");
  act(() => {
    (document.activeElement ?? dialogo)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  expect(onClose).toHaveBeenCalled();
});
