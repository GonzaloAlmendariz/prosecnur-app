// @vitest-environment happy-dom
// H10: el oyente de foco fija como campo en edición sólo controles editables, y salir del control corta el grupo.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, test } from "vitest";
import { crearAgrupador } from "./historialAgrupado";
import { campoDeFoco, useDeshacerPorCampo } from "./useDeshacerPorCampo";

describe("campoDeFoco", () => {
  test("inputs, selects, botones y switches agrupan; un div o el documento no", () => {
    const input = document.createElement("input");
    const sw = document.createElement("span");
    sw.setAttribute("role", "switch");
    expect(campoDeFoco(input)).toBe(input);
    expect(campoDeFoco(sw)).toBe(sw);
    expect(campoDeFoco(document.createElement("div"))).toBeNull();
    expect(campoDeFoco(null)).toBeNull();
  });
});

describe("useDeshacerPorCampo", () => {
  test("escribir en un input agrupa; al salir de él, la próxima edición abre paso", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const agrupador = crearAgrupador(600, () => 0);
    function Prueba() { useDeshacerPorCampo(agrupador); return <input aria-label="Corto" />; }
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<Prueba />));
    const input = host.querySelector("input")!;
    act(() => input.focus());
    expect(agrupador.agrupa(0)).toBe(false);
    expect(agrupador.agrupa(100)).toBe(true);
    act(() => input.blur());
    expect(agrupador.agrupa(200)).toBe(false);
    act(() => root.unmount());
    host.remove();
  });
});
