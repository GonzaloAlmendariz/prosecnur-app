/**
 * El aviso de fijaciones tiene DOS casos y decía el mismo texto en los dos.
 *
 * Ajustar una facultad invalida el resultado entero, así que en el caso más
 * común ninguna fijación tiene ya un número calculado contra el que
 * compararse: las quince salían anunciadas como «fijaste a mano los titulares
 * de 15 facultades» cuando el analista había tocado UNA. El número era cierto
 * y el rótulo mentía sobre lo que ese número cuenta.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { FijasPendientesAviso } from "../FijasPendientesAviso";

const quince = Array.from({ length: 15 }, (_, i) => ({
  label: `FACULTAD ${i + 1}`,
  aulas_base_fijas: i + 2,
})) as never;

function render(props: Parameters<typeof FijasPendientesAviso>[0]): string {
  return renderToStaticMarkup(createElement(FijasPendientesAviso, props));
}

describe("FijasPendientesAviso", () => {
  it("sin cálculo vigente no acusa al analista de haber fijado quince", () => {
    const html = render({ estratos: quince, aulasPorEstrato: [] });
    expect(html).toContain("15 facultades tienen los titulares fijados a mano");
    expect(html).not.toContain("Fijaste a mano");
    expect(html).toContain("el cálculo quedó pendiente");
    expect(html).toContain("quedará en");
  });

  it("con cálculo vigente nombra sólo lo que de verdad difiere, y contra qué", () => {
    const html = render({
      estratos: [
        { label: "ARQUITECTURA", aulas_base_fijas: 9 },
        { label: "DERECHO", aulas_base_fijas: 19 },
      ] as never,
      // DERECHO ya está aplicado; ARQUITECTURA no.
      aulasPorEstrato: [
        { estrato: "ARQUITECTURA", aulas_base: 8 },
        { estrato: "DERECHO", aulas_base: 19 },
      ],
    });
    expect(html).toContain("Fijaste a mano los titulares de 1 facultad");
    expect(html).toContain("la fórmula calculaba 8");
    expect(html).not.toContain("DERECHO");
  });

  it("sin fijaciones no pinta nada", () => {
    expect(render({ estratos: [{ label: "X" }] as never, aulasPorEstrato: [] })).toBe("");
  });
});
