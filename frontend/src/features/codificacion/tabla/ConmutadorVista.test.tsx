// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConmutadorVista } from "./ConmutadorVista";
import { useVistaCodificar } from "./vistaCodificarStore";

let host: HTMLDivElement;
let root: Root;

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

const radios = () => Array.from(host.querySelectorAll<HTMLButtonElement>('[role="radio"]'));

describe("ConmutadorVista", () => {
  test("es un grupo de dos opciones excluyentes, con la vista actual marcada", () => {
    act(() => root.render(<ConmutadorVista vista="tarjetas" onElegir={() => undefined} />));
    const grupo = host.querySelector('[role="radiogroup"]');
    expect(grupo?.getAttribute("aria-label")).toBe("Vista de las respuestas");
    expect(radios().map((r) => [r.textContent, r.getAttribute("aria-checked")])).toEqual([
      ["Tarjetas", "true"],
      ["Tabla", "false"],
    ]);
  });

  test("pulsar la otra vista la pide; pulsar la actual no", () => {
    const onElegir = vi.fn();
    act(() => root.render(<ConmutadorVista vista="tarjetas" onElegir={onElegir} />));
    act(() => radios()[0].click());
    expect(onElegir).not.toHaveBeenCalled();
    act(() => radios()[1].click());
    expect(onElegir).toHaveBeenCalledWith("tabla");
  });
});

describe("vista de Codificar recordada", () => {
  test("arranca en tarjetas y con las más repetidas primero", () => {
    expect(useVistaCodificar.getInitialState()).toMatchObject({ vista: "tarjetas", orden: "frecuencia" });
  });

  test("la elección queda en el store, fuera del componente que la pinta", () => {
    useVistaCodificar.getState().elegirVista("tabla");
    useVistaCodificar.getState().elegirOrden("alfabetico");
    expect(useVistaCodificar.getState()).toMatchObject({ vista: "tabla", orden: "alfabetico" });
    useVistaCodificar.setState(useVistaCodificar.getInitialState());
  });
});
