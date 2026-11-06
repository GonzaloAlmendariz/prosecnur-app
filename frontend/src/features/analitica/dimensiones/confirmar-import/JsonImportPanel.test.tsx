// @vitest-environment happy-dom
// «Aplicar plantilla al instrumento» monta el Dialog del kit (L1). Antes no
// cerraba con Escape: sólo con la X, Cancelar o un click en el velo.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { JsonImportPanel } from "./JsonImportPanel";

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

test("es un diálogo del kit, no deja continuar sin reporte y Escape lo cierra", () => {
  const onClose = vi.fn();
  act(() => root.render(
    <MemoryRouter initialEntries={["/analitica"]}>
      <JsonImportPanel open onClose={onClose} onApply={() => {}} />
    </MemoryRouter>,
  ));
  const dialogo = document.querySelector<HTMLElement>("[role='dialog']");
  expect(dialogo?.textContent).toContain("Aplicar plantilla al instrumento");
  const seguir = Array.from(dialogo?.querySelectorAll("button") ?? []).find((b) => b.textContent?.includes("Continuar con coincidencias"));
  expect(seguir?.disabled).toBe(true);
  act(() => {
    (document.activeElement ?? dialogo)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  expect(onClose).toHaveBeenCalled();
});

test("cerrado no monta nada", () => {
  act(() => root.render(
    <MemoryRouter><JsonImportPanel open={false} onClose={() => {}} onApply={() => {}} /></MemoryRouter>,
  ));
  expect(document.querySelector("[role='dialog']")).toBeNull();
});
