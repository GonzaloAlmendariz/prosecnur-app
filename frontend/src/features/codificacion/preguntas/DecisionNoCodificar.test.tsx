// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DecisionNoCodificar } from "./DecisionNoCodificar";

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
  vi.restoreAllMocks();
});

const boton = (texto: string) => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.trim() === texto);

describe("registrar que no se codifica", () => {
  test("al abrirse lleva el motivo a la vista dentro del inspector y pone el foco en el campo", () => {
    const aLaVista = vi.fn();
    Element.prototype.scrollIntoView = aLaVista;
    act(() => root.render(<DecisionNoCodificar decision="pendiente" onRegistrar={() => undefined} onRevertir={() => undefined} />));
    expect(aLaVista).not.toHaveBeenCalled();
    act(() => boton("Registrar que no se codifica")?.click());
    const caja = host.querySelector(".pulso-preg-decision[data-abierta]");
    expect(aLaVista).toHaveBeenCalledTimes(1);
    expect(aLaVista.mock.instances[0]).toBe(caja);
    expect(aLaVista).toHaveBeenCalledWith({ block: "nearest" });
    expect(document.activeElement).toBe(host.querySelector("input"));
  });

  test("el motivo es obligatorio: sin texto no se registra; con texto, Enter lo envía sin espacios sobrantes", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onRegistrar = vi.fn();
    act(() => root.render(<DecisionNoCodificar decision="pendiente_parcial" onRegistrar={onRegistrar} onRevertir={() => undefined} />));
    act(() => boton("Registrar que no se codifica")?.click());
    expect(boton("Registrar")?.disabled).toBe(true);
    const campo = host.querySelector("input") as HTMLInputElement;
    const escribir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      escribir?.call(campo, "  Dato personal ");
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(boton("Registrar")?.disabled).toBe(false);
    act(() => boton("Registrar")?.click());
    expect(onRegistrar).toHaveBeenCalledWith("Dato personal");
  });
});
