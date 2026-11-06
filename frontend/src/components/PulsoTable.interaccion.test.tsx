// @vitest-environment happy-dom
/**
 * Interacción de PulsoTable con controles dentro de sus celdas (L28, Analítica
 * › Datos). La fila elegible escucha Enter y Espacio para abrir el inspector;
 * esos mismos eventos suben desde un input de la celda, y la fila se los
 * tragaba: no se podía escribir un espacio en la etiqueta.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PulsoTable, type PulsoTableColumna } from "./PulsoTable";

type Fila = { id: string; etiqueta: string };

const columnas: PulsoTableColumna<Fila>[] = [
  { id: "id", encabezado: "Código", ancho: 120, celda: (f) => f.id },
  {
    id: "etiqueta",
    encabezado: "Etiqueta",
    ancho: 240,
    celda: (f) => <input aria-label={`Etiqueta de ${f.id}`} defaultValue={f.etiqueta} />,
  },
];

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

describe("PulsoTable · teclado con controles en la celda", () => {
  test("Espacio dentro de un input no elige la fila ni se cancela", () => {
    const onSeleccionar = vi.fn();
    act(() => root.render(
      <PulsoTable columnas={columnas} filas={[{ id: "p1", etiqueta: "Edad" }]} idDeFila={(f) => f.id} ariaLabel="Variables" onSeleccionar={onSeleccionar} />,
    ));
    const input = host.querySelector("input")!;
    const evento = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    act(() => { input.dispatchEvent(evento); });
    expect(onSeleccionar).not.toHaveBeenCalled();
    expect(evento.defaultPrevented).toBe(false);
  });

  test("Enter sobre la fila misma la elige", () => {
    const onSeleccionar = vi.fn();
    act(() => root.render(
      <PulsoTable columnas={columnas} filas={[{ id: "p1", etiqueta: "Edad" }]} idDeFila={(f) => f.id} ariaLabel="Variables" onSeleccionar={onSeleccionar} />,
    ));
    const fila = host.querySelector("tbody tr")!;
    act(() => { fila.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); });
    expect(onSeleccionar).toHaveBeenCalledWith("p1");
  });
});
