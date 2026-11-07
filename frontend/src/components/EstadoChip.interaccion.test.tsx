// @vitest-environment happy-dom
/**
 * EstadoChip dentro de una fila clicable (Monitoreo, 2 nov 2026): el estado sin
 * `onSelect` no debe tragarse el clic. Como `<button disabled>`, Chromium no despacha
 * el clic y la fila padre nunca se enteraba; como `<span role="status">`, el clic sube.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { EstadoChip } from "./EstadoChip";

describe("EstadoChip en una fila clicable", () => {
  let contenedor: HTMLDivElement;
  let raiz: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });
  afterEach(() => {
    act(() => raiz.unmount());
    contenedor.remove();
  });

  test("el clic en un estado sin onSelect llega a la fila padre", () => {
    const alElegirFila = vi.fn();
    act(() => raiz.render(<div data-testid="fila" onClick={alElegirFila}><EstadoChip label="sin aula" tone="warn" /></div>));
    const chip = contenedor.querySelector(".pulso-estado-chip");
    expect(chip?.tagName).toBe("SPAN");
    act(() => chip?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(alElegirFila).toHaveBeenCalledTimes(1);
  });

  test("con onSelect el chip responde como botón", () => {
    const alElegir = vi.fn();
    act(() => raiz.render(<EstadoChip label="ver lote" tone="info" onSelect={alElegir} />));
    const chip = contenedor.querySelector("button.pulso-estado-chip");
    act(() => chip?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(alElegir).toHaveBeenCalledTimes(1);
  });
});
