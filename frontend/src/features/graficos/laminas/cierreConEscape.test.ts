import { describe, expect, it, vi } from "vitest";
import { destinoDelFoco, escucharEscape } from "./cierreConEscape";

function tecla(key: string): Event {
  const e = new Event("keydown", { cancelable: true });
  Object.defineProperty(e, "key", { value: key });
  return e;
}

describe("el panel de Avisos se cierra con Escape desde cualquier foco (D5)", () => {
  it("con el foco en el disparador, Escape en el documento deja 0 paneles abiertos", () => {
    const documento = new EventTarget();
    let abiertos = 1;
    const soltar = escucharEscape(documento, () => { abiertos -= 1; });
    // El foco está en «N avisos» de la barra, fuera del panel: el evento llega al documento.
    const e = tecla("Escape");
    documento.dispatchEvent(e);
    expect(abiertos).toBe(0);
    expect(e.defaultPrevented).toBe(true);
    soltar();
  });

  it("otra tecla no cierra, ni un Escape que otro diálogo ya atendió", () => {
    const documento = new EventTarget();
    const cerrar = vi.fn();
    const soltar = escucharEscape(documento, cerrar);
    documento.dispatchEvent(tecla("Enter"));
    const atendido = tecla("Escape");
    atendido.preventDefault();
    documento.dispatchEvent(atendido);
    expect(cerrar).not.toHaveBeenCalled();
    soltar();
  });

  it("al desmontar deja de escuchar", () => {
    const documento = new EventTarget();
    const cerrar = vi.fn();
    escucharEscape(documento, cerrar)();
    documento.dispatchEvent(tecla("Escape"));
    expect(cerrar).not.toHaveBeenCalled();
  });

  it("el foco vuelve al disparador; si ya no está en el documento, al botón de la barra", () => {
    const disparador = { focus: vi.fn(), isConnected: true };
    const respaldo = { focus: vi.fn(), isConnected: true };
    expect(destinoDelFoco(disparador, respaldo)).toBe(disparador);
    expect(destinoDelFoco({ ...disparador, isConnected: false }, respaldo)).toBe(respaldo);
    expect(destinoDelFoco(null, respaldo)).toBe(respaldo);
  });
});
