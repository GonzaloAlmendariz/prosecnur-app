// @vitest-environment happy-dom
// H4 y ADR 0135 §8 (Datos, Cálculo y Aspecto): la cabecera de cada sección es un botón con aria-expanded; cerrada, el cuerpo sigue montado con
// hidden="until-found" (los mandos no pierden su estado y buscar en la página la abre). El índice abre y salta.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { useLaminasUi } from "../laminasStore";
import { SeccionPlegable } from "./SeccionPlegable";
import { AvisosLamina } from "../AvisosLamina";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useLaminasUi.setState({ seccionesTarjeta: {}, seccionReciente: null, avisosAbiertos: false });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("SeccionPlegable", () => {
  test("ítem 12: plegada, la cabecera dice lo propio de adentro; abierta, lo calla", () => {
    const resumen = { texto: "2 propios", detalle: "Sólo de este gráfico: Orden, Máximo de categorías." };
    act(() => root.render(<SeccionPlegable seccion="aspecto" resumen={resumen}><input aria-label="Orden" /></SeccionPlegable>));
    const boton = host.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
    const chip = () => boton.querySelector<HTMLElement>(".pulso-f6-grupo-resumen");
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    expect(chip()?.textContent).toBe("2 propios");
    expect(chip()?.title).toBe(resumen.detalle);
    act(() => boton.click());
    expect(chip()).toBeNull();
  });
  test("Cálculo arranca cerrada, se abre con su botón y se recuerda en el store", () => {
    act(() => root.render(<SeccionPlegable seccion="calculo"><input aria-label="Decimales" /></SeccionPlegable>));
    const boton = host.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
    const cuerpo = host.querySelector<HTMLElement>(".pulso-f6-grupo-cuerpo")!;
    expect(boton.textContent).toContain("Cálculo");
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    expect(boton.getAttribute("aria-controls")).toBe(cuerpo.id);
    expect(cuerpo.getAttribute("hidden")).toBe("until-found");
    expect(cuerpo.querySelector("input")).not.toBeNull();   // montado: conserva su estado
    act(() => boton.click());
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    expect(cuerpo.hasAttribute("hidden")).toBe(false);
    expect(useLaminasUi.getState().seccionesTarjeta.calculo).toBe(true);
    expect(useLaminasUi.getState().seccionReciente).toBe("calculo");
  });

  test("buscar en la página un mando escondido abre su sección (beforematch)", () => {
    act(() => root.render(<SeccionPlegable seccion="aspecto"><span>Tabla de datos en el Word</span></SeccionPlegable>));
    const cuerpo = host.querySelector<HTMLElement>(".pulso-f6-grupo-cuerpo")!;
    act(() => { cuerpo.dispatchEvent(new Event("beforematch")); });
    expect(useLaminasUi.getState().seccionesTarjeta.aspecto).toBe(true);
    expect(cuerpo.hasAttribute("hidden")).toBe(false);
  });

  test("Datos arranca abierta", () => {
    act(() => root.render(<SeccionPlegable seccion="datos"><span>Pregunta</span></SeccionPlegable>));
    expect(host.querySelector("button")!.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("AvisosLamina", () => {
  test("un chip con el conteo que despliega la lista", () => {
    act(() => root.render(<AvisosLamina avisos={["La pregunta se lee de la base principal.", "Falta el color de «Otros»."]} />));
    const chip = host.querySelector<HTMLButtonElement>("button")!;
    const lista = host.querySelector("ul")!;
    expect(chip.textContent).toContain("2 avisos en esta lámina");
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    expect(lista.hidden).toBe(true);
    act(() => chip.click());
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    expect(lista.hidden).toBe(false);
    expect(lista.querySelectorAll("li")).toHaveLength(2);
  });

  test("sin avisos no pinta nada", () => {
    act(() => root.render(<AvisosLamina avisos={[]} />));
    expect(host.innerHTML).toBe("");
  });
});
