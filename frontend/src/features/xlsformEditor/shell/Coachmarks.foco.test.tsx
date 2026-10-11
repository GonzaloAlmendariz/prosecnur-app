// @vitest-environment happy-dom
/**
 * L8 — el callout del tour es un diálogo modal: `role="dialog"` +
 * `aria-modal="true"`, foco inicial en el callout, Tab atrapado dentro,
 * Escape lo cierra y el foco vuelve a lo que estaba enfocado al abrirse.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Coachmarks } from "./Coachmarks";
import { siguienteFocoAtrapado } from "./coachmarkFocus";

let host: HTMLDivElement;
let root: Root;
let origen: HTMLButtonElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  // Target del primer paso y elemento enfocado antes de que aparezca el tour.
  const tarjeta = document.createElement("div");
  tarjeta.className = "pulso-canvas-card";
  document.body.appendChild(tarjeta);
  origen = document.createElement("button");
  origen.textContent = "Origen";
  document.body.appendChild(origen);
  origen.focus();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

function callout(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".pulso-coachmarks-callout");
}

function tecla(key: string, shiftKey = false) {
  act(() => {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }),
    );
  });
}

describe("Coachmarks · diálogo modal", () => {
  test("declara role=dialog + aria-modal y nombra el paso", () => {
    act(() => root.render(<Coachmarks forceShow />));
    const el = callout()!;
    expect(el.getAttribute("role")).toBe("dialog");
    expect(el.getAttribute("aria-modal")).toBe("true");
    const titulo = document.getElementById(el.getAttribute("aria-labelledby") ?? "");
    expect(titulo?.textContent).toBe("Edición en foco");
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  test("el foco inicial va al callout", () => {
    act(() => root.render(<Coachmarks forceShow />));
    expect(document.activeElement).toBe(callout());
  });

  test("Tab queda atrapado entre las acciones del callout", () => {
    act(() => root.render(<Coachmarks forceShow />));
    const [saltar, siguiente] = Array.from(callout()!.querySelectorAll("button"));

    tecla("Tab");
    expect(document.activeElement).toBe(saltar);
    act(() => siguiente!.focus());
    tecla("Tab");
    expect(document.activeElement).toBe(saltar);
    tecla("Tab", true);
    expect(document.activeElement).toBe(siguiente);
  });

  test("Escape cierra el tour y devuelve el foco a lo que lo tenía", () => {
    act(() => root.render(<Coachmarks forceShow />));
    expect(document.activeElement).not.toBe(origen);

    tecla("Escape");

    expect(callout()).toBeNull();
    expect(document.activeElement).toBe(origen);
    expect(localStorage.getItem("pulso.xlsformEditor.firstUseDone")).toBe("true");
  });

  test("«Saltar tour» también devuelve el foco", () => {
    act(() => root.render(<Coachmarks forceShow />));
    const saltar = Array.from(callout()!.querySelectorAll("button")).find((b) => b.textContent === "Saltar tour")!;
    act(() => saltar.click());
    expect(callout()).toBeNull();
    expect(document.activeElement).toBe(origen);
  });
});

describe("siguienteFocoAtrapado", () => {
  test("cicla en los extremos y entra por el extremo correcto", () => {
    const xs = ["a", "b", "c"];
    expect(siguienteFocoAtrapado(xs, "c", false)).toBe("a");
    expect(siguienteFocoAtrapado(xs, "a", true)).toBe("c");
    expect(siguienteFocoAtrapado(xs, "b", false)).toBeNull();
    expect(siguienteFocoAtrapado(xs, null, false)).toBe("a");
    expect(siguienteFocoAtrapado(xs, null, true)).toBe("c");
    expect(siguienteFocoAtrapado([], null, false)).toBeNull();
  });
});
