// @vitest-environment happy-dom
/**
 * L2: un `?panel=` que no abre nada se BORRA de la dirección.
 *
 * Paneles cuyo contenido depende de un dato —la reconciliación de Carga sin
 * variables extra, los diálogos de edición del Dashboard sin fuente o en
 * vista previa— dejaban la URL diciendo «panel abierto» sobre una pantalla
 * sin panel (QA de L2, FAIL C5/C3). La URL tiene que reproducir lo que se ve.
 *
 * Sin Testing Library ni JSX: `react-dom/client` + `act`, como
 * `components/Dialog.interaccion.test.tsx`.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  resolverPanelCondicionado,
  usePanelCondicionado,
  usePanelDireccionable,
  type PanelDeclarado,
} from "./paneles";

const PANEL: PanelDeclarado = { id: "reconciliacion", label: "Reconciliación", clase: "dialogo" };

describe("resolverPanelCondicionado", () => {
  test("cerrado si la dirección no lo pide, aunque aplique", () => {
    expect(resolverPanelCondicionado(false, { resuelto: true, aplica: true })).toBe("cerrado");
  });
  test("espera mientras el dato no respondió: no borra un enlace válido antes de tiempo", () => {
    expect(resolverPanelCondicionado(true, { resuelto: false, aplica: false })).toBe("esperar");
  });
  test("abre cuando el dato respondió y aplica", () => {
    expect(resolverPanelCondicionado(true, { resuelto: true, aplica: true })).toBe("abrir");
  });
  test("borra cuando el dato respondió y no aplica (p. ej. reconciliación con n_extra=0)", () => {
    expect(resolverPanelCondicionado(true, { resuelto: true, aplica: false })).toBe("borrar");
  });
});

let host: HTMLDivElement;
let root: Root;
const observado: { search: string; visible: boolean } = { search: "", visible: false };

function Sonda({ resuelto, aplica }: { resuelto: boolean; aplica: boolean }) {
  const control = usePanelDireccionable(PANEL);
  observado.visible = usePanelCondicionado(control, { resuelto, aplica });
  observado.search = useLocation().search;
  return null;
}

function montar(search: string, estado: { resuelto: boolean; aplica: boolean }) {
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [`/carga${search}`] },
        createElement(Sonda, estado),
      ),
    );
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("usePanelCondicionado", () => {
  test("un panel en la URL que no aplica se borra y conserva el resto de la dirección", () => {
    montar("?pestana=revision&panel=reconciliacion", { resuelto: true, aplica: false });
    expect(observado.visible).toBe(false);
    expect(observado.search).toBe("?pestana=revision");
  });

  test("mientras el dato carga, el param se conserva y no se pinta nada", () => {
    montar("?pestana=revision&panel=reconciliacion", { resuelto: false, aplica: false });
    expect(observado.visible).toBe(false);
    expect(observado.search).toBe("?pestana=revision&panel=reconciliacion");
  });

  test("si aplica, se pinta y la URL queda como está", () => {
    montar("?pestana=revision&panel=reconciliacion", { resuelto: true, aplica: true });
    expect(observado.visible).toBe(true);
    expect(observado.search).toBe("?pestana=revision&panel=reconciliacion");
  });
});
