// Mata (C1, ADR 0128): la maqueta prometiendo puntos rojos que la lámina no dibuja, o la cápsula sin cruce.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ajustesDelGlifo } from "../laminas/maqueta/fichaModelo";
import { CuerpoGlifo } from "./GlifoGrafico";

describe("glifo de diferencias entre grupos", () => {
  for (const tipo of ["p_barras_agrupadas", "p_barras_categoricas"]) {
    it(`${tipo}: con cruce dibuja la cápsula ▲ en las filas que difieren, sin puntos de énfasis`, () => {
      const html = renderToStaticMarkup(<svg><CuerpoGlifo tipo={tipo} opciones={{ grupos: true, significancia: true }} /></svg>);
      expect(html.match(/pulso-glifo__sig-capsula/g)?.length).toBe(2);
      expect(html).not.toContain("pulso-glifo__r\"");
    });
  }
  it("sin cruce la maqueta no promete marcas", () => {
    expect(ajustesDelGlifo("p_barras_agrupadas", { mostrar_significancia: true }, false).glifo.significancia).toBe(false);
    expect(ajustesDelGlifo("p_barras_agrupadas", { mostrar_significancia: true }, true).glifo.significancia).toBe(true);
  });
});
