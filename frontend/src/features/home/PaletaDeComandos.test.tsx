// @vitest-environment happy-dom
/**
 * L30 — la paleta se abre con el modificador del sistema + K y no le pisa el atajo a un editor que ya lo usa.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PaletaDeComandosHost } from "./PaletaDeComandos";

let host: HTMLDivElement;
let root: Root;
let busqueda = "";

function Espia() {
  busqueda = useLocation().search;
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

  test("si un editor ya atendió el atajo, la paleta no se abre encima", () => {
    teclear({ ctrlKey: true }, true);
    expect(busqueda).not.toContain("panel=paleta");
  });
});
