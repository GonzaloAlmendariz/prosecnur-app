// @vitest-environment happy-dom
// La revisión del mapeo de códigos monta el Dialog del kit (L1): Escape cierra
// (antes no), salvo mientras se aplica el mapeo.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ChoiceCodeMapReview } from "../../api/xlsformEditor";
import { ChoiceMappingReviewDialog } from "./ChoiceMappingReviewDialog";

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

const review = { requires_confirmation: true, maps: [] } as unknown as ChoiceCodeMapReview;

function montar(busy: boolean, onClose: () => void) {
  act(() => root.render(
    <MemoryRouter initialEntries={["/carga"]}>
      <ChoiceMappingReviewDialog review={review} busy={busy} onClose={onClose} onConfirm={async () => {}} />
    </MemoryRouter>,
  ));
  return document.querySelector<HTMLElement>("[role='dialog']");
}

function escape(destino: Element | null) {
  act(() => {
    (document.activeElement ?? destino)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
}

test("es un diálogo del kit con su acción, y Escape lo cierra", () => {
  const onClose = vi.fn();
  const dialogo = montar(false, onClose);
  expect(dialogo?.textContent).toContain("Usar mapeo recomendado");
  expect(dialogo?.textContent).toContain("Usar este mapeo");
  escape(dialogo);
  expect(onClose).toHaveBeenCalled();
});

test("mientras se aplica el mapeo, Escape no lo cierra", () => {
  const onClose = vi.fn();
  escape(montar(true, onClose));
  expect(onClose).not.toHaveBeenCalled();
});
