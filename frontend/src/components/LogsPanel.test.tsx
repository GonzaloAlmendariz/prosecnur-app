// @vitest-environment happy-dom
// LogsPanel sobre el Dialog del kit (L1): el atajo es ⌘⇧L en macOS y
// Ctrl+Shift+L en Windows (T1), y abre un diálogo del kit fuera del router.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import LogsPanel, { esAtajoDeLogs } from "./LogsPanel";

const tecla = (o: Partial<{ key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }>) => ({
  key: "l", shiftKey: true, metaKey: false, ctrlKey: false, ...o,
});

describe("atajo del registro (T1)", () => {
  test("macOS: ⌘⇧L sí, Ctrl+Shift+L no", () => {
    expect(esAtajoDeLogs(tecla({ metaKey: true }), true)).toBe(true);
    expect(esAtajoDeLogs(tecla({ ctrlKey: true }), true)).toBe(false);
  });
  test("Windows: Ctrl+Shift+L sí, ⌘⇧L no; sin Shift no", () => {
    expect(esAtajoDeLogs(tecla({ ctrlKey: true }), false)).toBe(true);
    expect(esAtajoDeLogs(tecla({ metaKey: true }), false)).toBe(false);
    expect(esAtajoDeLogs(tecla({ ctrlKey: true, shiftKey: false }), false)).toBe(false);
  });
});

describe("panel", () => {
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

  test("el atajo abre un diálogo del kit sin router", () => {
    act(() => root.render(<LogsPanel />));
    expect(document.querySelector("[role='dialog']")).toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "l", shiftKey: true, metaKey: true, ctrlKey: true, bubbles: true }));
    });
    const dialogo = document.querySelector<HTMLElement>("[role='dialog']");
    expect(dialogo?.className).toContain("pulso-dialog");
    expect(dialogo?.textContent).toContain("Registro de la sesión");
  });
});
