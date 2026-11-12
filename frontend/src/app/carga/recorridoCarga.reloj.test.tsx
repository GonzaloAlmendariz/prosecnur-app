// @vitest-environment happy-dom
/**
 * Reloj del recorrido montado (12 nov 2026, Gonzalo: "a veces en la transición de una animación a otra se traba").
 * El reloj de la lámina late cada segundo; el recorrido cambia de escena en el borde exacto de su tramo, aunque el
 * transcurrido que recibe siga quieto.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TRAMO_MS } from "./escenasMotor";
import { RecorridoCarga, reiniciarBolsasEscenas } from "./RecorridoCarga";

let raiz: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  reiniciarBolsasEscenas();
  host = document.createElement("div");
  document.body.appendChild(host);
  raiz = createRoot(host);
});

afterEach(() => {
  act(() => raiz.unmount());
  host.remove();
  vi.useRealTimers();
});

const modulo = () => host.querySelector("[data-recorrido-modulo]")?.getAttribute("data-recorrido-modulo");
const escena = () => host.querySelector("[data-escena]")?.getAttribute("data-escena");

describe("reloj del recorrido", () => {
  test("cambia de módulo en el borde exacto del tramo, sin esperar al latido del reloj", () => {
    act(() => raiz.render(<RecorridoCarga transcurridoMs={0} />));
    expect(modulo()).toBe("calc-muestra");
    act(() => vi.advanceTimersByTime(TRAMO_MS - 5));
    expect(modulo()).toBe("calc-muestra");
    act(() => vi.advanceTimersByTime(10));
    expect(modulo()).toBe("editor-xlsform");
  });

  test("montado a mitad de un tramo, la escena dura el tramo entero", () => {
    act(() => raiz.render(<RecorridoCarga transcurridoMs={TRAMO_MS * 2 + 3000} />));
    expect(modulo()).toBe("hojas-ruta");
    act(() => vi.advanceTimersByTime(TRAMO_MS - 5));
    expect(modulo()).toBe("hojas-ruta");
  });

  test("en cinco vueltas Hojas de ruta muestra sus cinco escenas", () => {
    act(() => raiz.render(<RecorridoCarga transcurridoMs={TRAMO_MS * 2} />));
    const vistas = new Set<string | null | undefined>();
    for (let v = 0; v < 5; v++) {
      expect(modulo()).toBe("hojas-ruta");
      vistas.add(escena());
      act(() => vi.advanceTimersByTime(TRAMO_MS * 7));
    }
    expect(vistas.size).toBe(5);
  });
});
