// I7 del rediseño (2026-10-14). Mata: una barra que se pinta sin selección (ocuparía el pie siempre), que pierde un
// atajo a la vista o que deja de ofrecer los capítulos habilitados como destino.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarraSeleccion } from "./BarraSeleccion";
import type { FilaVistaGeneral } from "./modeloVistaGeneral";

const filas = [{ id: "ap", rotulo: "Apertura" }, { id: "c1", rotulo: "1. Satisfacción" }] as unknown as FilaVistaGeneral[];
const nada = () => undefined;
const pintar = (seleccionadas: number) => renderToStaticMarkup(createElement(BarraSeleccion, {
  filas, seleccionadas, destinosHabilitados: new Set(["c1"]), onMoverA: nada, onDuplicar: nada, onEliminar: nada, onVaciar: nada,
}));

describe("barra de selección del Informe", () => {
  it("no se pinta sin láminas elegidas", () => {
    expect(pintar(0)).toBe("");
  });

  it("dice cuántas, ofrece los destinos habilitados y muestra sus atajos", () => {
    const html = pintar(2);
    expect(html).toContain("<strong>2</strong> láminas elegidas");
    expect(html).toMatch(/<option value="ap" disabled="">Apertura<\/option>/);
    expect(html).toMatch(/<option value="c1" selected="">1\. Satisfacción<\/option>/);
    expect(html).toContain("<kbd>Supr</kbd>");
    expect(html).toContain('aria-label="Soltar la selección"');
  });
});
