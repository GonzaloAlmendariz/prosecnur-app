// @vitest-environment happy-dom
// «Importar mapa del estudio» monta el Dialog del kit (L1): nombre accesible,
// el botón Importar bloqueado sin revisión, y Escape que cierra.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PanelImportar } from "./PanelImportar";

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

test("es un diálogo del kit, no deja importar sin revisión y Escape lo cierra", () => {
  const onCerrar = vi.fn();
  act(() => root.render(
    <MemoryRouter initialEntries={["/bitacora"]}>
      <PanelImportar onImportado={() => {}} onCerrar={onCerrar} />
    </MemoryRouter>,
  ));
  const dialogo = document.querySelector<HTMLElement>("[role='dialog']");
  expect(dialogo?.textContent).toContain("Importar mapa del estudio");
  const importar = Array.from(dialogo?.querySelectorAll("button") ?? []).find((b) => b.textContent?.includes("Importar"));
  expect(importar?.disabled).toBe(true);
  act(() => {
    (document.activeElement ?? dialogo)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  expect(onCerrar).toHaveBeenCalled();
});
