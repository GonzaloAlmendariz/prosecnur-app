// @vitest-environment happy-dom
// El error de una subida hecha desde "Agregar base" se dibujaba en la pila de
// avisos de la página, detrás del velo del diálogo: el usuario no veía nada.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AgregarBase, type AgregarBaseProps } from "./AgregarBase";

const props = (errorDeCarga: string): AgregarBaseProps => ({
  varias: false, estrategia: "integrated", estudio: null, cambiaFuente: false, ocupado: false,
  onOrigen: () => undefined, panelPlataforma: null, panelMonitoreo: null,
  subidaDeUnaBase: <p>Tarjetas de subida</p>, onEstudioCambiado: async () => undefined,
  onBaseSavRegistrada: () => undefined, entradasPrevistas: 1, entradasMinimas: 0,
  onEntradasPrevistas: () => undefined, hayFormularioDeSesion: false, errorDeCarga,
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function pintar(errorDeCarga: string) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/carga?panel=agregar-base&foco=archivos"]}>
        <AgregarBase {...props(errorDeCarga)} />
      </MemoryRouter>,
    );
  });
}

describe("AgregarBase", () => {
  test("el error de la carga se ve dentro del diálogo", () => {
    pintar("El archivo no tiene la hoja \"survey\" de un formulario XLSForm.");
    const dialogo = document.querySelector("[role='dialog']");
    expect(dialogo?.textContent).toContain("Tarjetas de subida");
    expect(dialogo?.textContent).toContain("No se pudo completar la carga");
    expect(dialogo?.textContent).toContain("no tiene la hoja \"survey\"");
  });

  test("sin error no dibuja el aviso", () => {
    pintar("");
    expect(document.querySelector("[role='dialog']")?.textContent).not.toContain("No se pudo completar la carga");
  });
});
