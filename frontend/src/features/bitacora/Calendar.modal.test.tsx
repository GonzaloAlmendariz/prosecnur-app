// @vitest-environment happy-dom
// El modal de actividad del calendario monta el Dialog del kit (L1): antes era
// un velo con aria-modal pero sin Escape ni foco atrapado.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EventModal } from "./Calendar";

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

test("«Nueva actividad» es un diálogo del kit y Escape lo cierra", () => {
  const onClose = vi.fn();
  act(() => root.render(
    <MemoryRouter initialEntries={["/planner"]}>
      <EventModal modal={{ mode: "create", date: "2026-10-28" }} onClose={onClose} onChange={() => {}} />
    </MemoryRouter>,
  ));
  const dialogo = document.querySelector<HTMLElement>("[role='dialog']");
  expect(dialogo?.className).toContain("pulso-dialog");
  expect(dialogo?.textContent).toContain("Nueva actividad");
  expect(Array.from(dialogo?.querySelectorAll("button") ?? []).some((b) => b.textContent?.includes("Crear"))).toBe(true);
  act(() => {
    (document.activeElement ?? dialogo)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  expect(onClose).toHaveBeenCalled();
});
