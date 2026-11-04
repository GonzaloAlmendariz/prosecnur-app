// @vitest-environment happy-dom
/**
 * `?panel=configuracion&foco=…` abre la sección pedida también desde el Home (4 nov 2026). En `/` no
 * hay dirección de módulo y `useDireccion` da null: el foco se leía de ahí y se perdía, así que
 * `/?panel=configuracion&foco=credits` abría siempre en Conexiones.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

let recibida: unknown = "sin montar";

vi.mock("../../lib/lazyWithReload", () => ({
  lazyWithReload: () => (props: { seccion: unknown }) => {
    recibida = props.seccion;
    return null;
  },
}));

import { ConfiguracionHost } from "./ConfiguracionHost";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  recibida = "sin montar";
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function abrir(entrada: string) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[entrada]}>
        <ConfiguracionHost />
      </MemoryRouter>,
    );
  });
  return recibida;
}

describe("ConfiguracionHost lee la sección del foco", () => {
  test("desde el Home, fuera de un módulo", () => {
    expect(abrir("/?panel=configuracion&foco=credits")).toBe("credits");
  });

  test("desde un módulo, con el alias «conexiones»", () => {
    expect(abrir("/procesamiento?seccion=carga&panel=configuracion&foco=conexiones")).toBe("connections");
  });

  test("sin foco no fuerza sección", () => {
    expect(abrir("/?panel=configuracion")).toBeNull();
  });
});
