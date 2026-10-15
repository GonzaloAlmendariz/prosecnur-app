// I4 del rediseño (2026-10-14). Mata: una estructura que no lista los bloques, que no marca el capítulo con láminas que
// piden atención o que cuenta mal sus láminas.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstructuraLateral } from "./EstructuraLateral";
import type { FilaVistaGeneral } from "./modeloVistaGeneral";

const fila = (id: string, clase: "bloque" | "capitulo", titulo: string, ids: string[], numero: string | null = null) =>
  ({ id, clase, titulo, numero, rotulo: titulo, ids, tarjetas: [], conteo: { laminas: ids.length, conGrafico: 0, incompletas: 0 } }) as unknown as FilaVistaGeneral;

describe("estructura lateral del Informe", () => {
  it("un botón por bloque y capítulo, con su conteo y un punto donde algo pide atención", () => {
    const html = renderToStaticMarkup(createElement(EstructuraLateral, {
      filas: [fila("ap", "bloque", "Apertura", ["a", "b"]), fila("c1", "capitulo", "Satisfacción", ["c", "d", "e"], "1")],
      estados: new Map([["d", { clave: "colores", texto: "Faltan colores" }], ["a", { clave: "lista", texto: "Lista" }]]),
      onIr: () => undefined,
    }));
    expect(html.match(/pulso-f6-vg-ol /g)?.length).toBe(2);
    expect(html).toContain('aria-label="Apertura: 2 láminas"');
    expect(html).toContain('aria-label="Satisfacción: 3 láminas, 1 pide atención"');
    expect(html.match(/pulso-f6-vg-ol-punto/g)?.length).toBe(1);
  });
});
