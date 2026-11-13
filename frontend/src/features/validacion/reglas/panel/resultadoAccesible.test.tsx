// @vitest-environment happy-dom
// Los radios de la clase ("Inconsistencia" y "Caso a revisar") tienen nombre accesible.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ClasificacionHallazgo from "../../components/ClasificacionHallazgo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
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

describe("la clase del hallazgo en el panel de regla", () => {
  it("cada radio tiene nombre accesible", () => {
    act(() => root.render(<ClasificacionHallazgo value="caso_validar" onChange={() => undefined} />));
    const radios = [...host.querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["Inconsistencia", "Caso a revisar"]);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true"]);
  });
});
