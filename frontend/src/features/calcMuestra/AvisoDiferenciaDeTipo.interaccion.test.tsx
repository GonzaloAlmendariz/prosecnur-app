// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AvisoDiferenciaDeTipo } from "./AvisoDiferenciaDeTipo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("AvisoDiferenciaDeTipo (hallazgo 11)", () => {
  test('nombra las dos fuentes y "Alinear" pide el modo que fija el tipo', () => {
    const onAlinear = vi.fn();
    act(() => root.render(
      <MemoryRouter>
        <AvisoDiferenciaDeTipo
          diferencia={{ desk: "territorial_handoff", titulo: "Muestreo de áreas y viviendas", actual: "Conglomerados en aulas", tipo: "Territorial presencial", origen: "deducido" }}
          onAlinear={onAlinear}
        />
      </MemoryRouter>,
    ));
    const texto = host.textContent ?? "";
    expect(texto).toContain('"Territorial presencial"');
    // 5 nov 2026: una oración (pulido de UI); sigue nombrando las dos fuentes.
    expect(texto).toContain("la ficha no declara el tipo");
    expect(texto).toContain('que aquí es "Muestreo de áreas y viviendas"');
    expect(texto).toContain('el escenario guardado es "Conglomerados en aulas"');
    const boton = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Alinear con la ficha"));
    act(() => boton?.click());
    expect(onAlinear).toHaveBeenCalledWith("territorial_handoff");
  });
});
