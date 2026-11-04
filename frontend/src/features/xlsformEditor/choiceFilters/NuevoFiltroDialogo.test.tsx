// @vitest-environment happy-dom
// «Nuevo filtro» monta el Dialog del kit (L1): nombre accesible, pasos en la
// banda del stepper y Escape que cierra, sin trampa de foco escrita a mano.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { NuevoFiltroDialogo } from "./NuevoFiltroDialogo";

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

test("es un diálogo del kit con sus pasos, y Escape lo cierra", () => {
  const onCerrar = vi.fn();
  const workbook = { choices: { columns: [], rows: [] } } as unknown as XlsformEditorWorkbook;
  act(() => root.render(
    <MemoryRouter initialEntries={["/editor-xlsform"]}>
      <NuevoFiltroDialogo preguntas={[]} candidatasDe={() => []} workbook={workbook} onCrear={() => {}} onAbrir={() => {}} onCerrar={onCerrar} />
    </MemoryRouter>,
  ));
  const dialogo = document.querySelector<HTMLElement>("[role='dialog']");
  expect(dialogo?.closest(".pulso-overlay, .xcf-dialogo-kit") ?? dialogo?.querySelector(".xcf-dialogo-kit")).toBeTruthy();
  expect(dialogo?.textContent).toContain("Nuevo filtro");
  expect(dialogo?.querySelector(".xcf-pasos")?.textContent).toContain("1. Pregunta");
  act(() => {
    (document.activeElement ?? dialogo)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  expect(onCerrar).toHaveBeenCalled();
});
