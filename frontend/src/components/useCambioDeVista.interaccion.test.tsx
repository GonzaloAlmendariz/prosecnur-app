// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PageFrame } from "./PageFrame";
import { claveDeVista } from "./useCambioDeVista";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let ir: (to: string) => void = () => undefined;

function Navegador() {
  const navigate = useNavigate();
  ir = (to) => navigate(to);
  return null;
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const cuerpo = () => host.querySelector(".pulso-page-frame-body");

describe("transición al cambiar de sección o pestaña (6 nov 2026)", () => {
  test("la clave sólo mira sección y pestaña (y sus alias), no el panel ni el foco", () => {
    expect(claveDeVista("?seccion=avance&pestana=ump&panel=filtros")).toBe(claveDeVista("?seccion=avance&pestana=ump"));
    expect(claveDeVista("?tab=datos")).toBe("|datos");
    expect(claveDeVista("?seccion=a")).not.toBe(claveDeVista("?seccion=b"));
  });

  test("cambiar de pestaña alterna la marca del cuerpo sin re-montarlo; abrir un panel no", () => {
    act(() => root.render(
      <MemoryRouter initialEntries={["/analitica?pestana=datos"]}>
        <Navegador />
        <PageFrame title="Analítica"><p>contenido</p></PageFrame>
      </MemoryRouter>,
    ));
    const antes = cuerpo();
    expect(antes?.getAttribute("data-cambio-vista")).toBeNull();
    act(() => ir("/analitica?pestana=frecuencias"));
    expect(cuerpo()).toBe(antes);
    const primera = cuerpo()?.getAttribute("data-cambio-vista");
    expect(primera === "a" || primera === "b").toBe(true);
    act(() => ir("/analitica?pestana=frecuencias&panel=universo"));
    expect(cuerpo()?.getAttribute("data-cambio-vista")).toBe(primera);
    act(() => ir("/analitica?pestana=cruces"));
    expect(cuerpo()?.getAttribute("data-cambio-vista")).not.toBe(primera);
  });
});
