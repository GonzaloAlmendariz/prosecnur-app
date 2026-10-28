// @vitest-environment happy-dom
/**
 * L30 — la paleta se abre con el modificador del sistema + K y no le pisa el atajo a un editor que ya lo usa.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PROSECNUR_PRIMARY_ACTIVE_MODULES } from "../../lib/modules";

vi.mock("../project/ProjectModulesContext", () => ({
  useProjectModules: () => ({ addedSlugs: PROSECNUR_PRIMARY_ACTIVE_MODULES.map((m) => m.slug) }),
}));
import { PaletaDeComandosHost } from "./PaletaDeComandos";

let host: HTMLDivElement;
let root: Root;
let busqueda = "";
let ruta = "";

function Espia() {
  const location = useLocation();
  busqueda = location.search;
  ruta = location.pathname;
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  busqueda = "";
  act(() => root.render(<MemoryRouter initialEntries={["/carga"]}><PaletaDeComandosHost /><Espia /></MemoryRouter>));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function teclear(init: KeyboardEventInit, prevenido = false) {
  const evento = new KeyboardEvent("keydown", { key: "k", bubbles: true, cancelable: true, ...init });
  if (prevenido) evento.preventDefault();
  act(() => { window.dispatchEvent(evento); });
}

describe("paleta de comandos · atajo", () => {
  test("Ctrl+K (Windows/Linux en el test) escribe ?panel=paleta sobre la ruta actual", () => {
    teclear({ ctrlKey: true });
    expect(busqueda).toContain("panel=paleta");
  });

  test("K sola no la abre", () => {
    teclear({});
    expect(busqueda).not.toContain("panel=paleta");
  });

  test("⌘N/Ctrl+N no navega si una vista lo atiende después en la misma ronda", async () => {
    const vista = (e: KeyboardEvent) => e.preventDefault();
    window.addEventListener("keydown", vista);
    teclear({ key: "1", ctrlKey: true });
    await act(async () => { await Promise.resolve(); });
    window.removeEventListener("keydown", vista);
    expect(ruta).toBe("/carga");
  });

  test("Ctrl+1 abre el primer módulo del dock", async () => {
    teclear({ key: "1", ctrlKey: true });
    await act(async () => { await Promise.resolve(); });
    expect(ruta).toBe(PROSECNUR_PRIMARY_ACTIVE_MODULES[0].to);
  });

  test("si un editor ya atendió el atajo, la paleta no se abre encima", () => {
    teclear({ ctrlKey: true }, true);
    expect(busqueda).not.toContain("panel=paleta");
  });
});
