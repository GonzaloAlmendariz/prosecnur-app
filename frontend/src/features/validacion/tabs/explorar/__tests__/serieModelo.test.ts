import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { ExploradorCrucePunto } from "../../../../../api/validacionExplorar";
import CruceSerie from "../CruceSerie";
import { bajadaDeSerie, barrasApiladas, modoDeSerie } from "../serieModelo";

const p = (fecha: string, valor: number, serie: string | null, baja: number | null = null, alta: number | null = null): ExploradorCrucePunto => ({
  fecha, valor, baja, alta, serie,
});

describe("serie por fecha del cruce (E8j, E8k, E8l)", () => {
  it("el modo sale de la variable que se lee: única apila, múltiple en %, numérica mediana", () => {
    expect(modoDeSerie("so")).toBe("apilada");
    expect(modoDeSerie("sm")).toBe("porcentaje");
    expect(modoDeSerie("num")).toBe("mediana");
    expect(bajadaDeSerie("mediana")).toContain("percentil 25 al 75");
  });

  it("las barras apiladas suman los casos del día, por categoría y en el orden de la leyenda", () => {
    const { fechas, series, barras, max } = barrasApiladas([
      p("2026-06-14", 3, "Mujer"), p("2026-06-13", 5, "Hombre"), p("2026-06-13", 2, "Mujer"), p("2026-06-14", 0, "Hombre"),
    ]);
    expect(fechas).toEqual(["2026-06-13", "2026-06-14"]);
    expect(series).toEqual(["Mujer", "Hombre"]);
    expect(barras[0]).toEqual({
      fecha: "2026-06-13",
      total: 7,
      tramos: [{ serie: "Mujer", desde: 0, hasta: 2, n: 2 }, { serie: "Hombre", desde: 2, hasta: 7, n: 5 }],
    });
    expect(barras[1].total).toBe(3);
    expect(max).toBe(7);
  });

  it("la única se dibuja como barras, no como líneas superpuestas", () => {
    const html = renderToStaticMarkup(createElement(CruceSerie, {
      modo: "apilada",
      puntos: [p("2026-06-13", 5, "Hombre"), p("2026-06-13", 2, "Mujer"), p("2026-06-14", 3, "Hombre"), p("2026-06-14", 0, "Mujer")],
    }));
    expect(html.match(/class="vx-svg-barra"/g)?.length).toBe(3);
    expect(html).not.toContain("vx-svg-linea");
    expect(html).toContain(">7<");
  });

  it("la múltiple va en una escala de 0 a 100 %", () => {
    const html = renderToStaticMarkup(createElement(CruceSerie, {
      modo: "porcentaje",
      puntos: [p("2026-06-13", 40, "Radio"), p("2026-06-14", 12.5, "Radio")],
    }));
    expect(html).toContain(">0.0%<");
    expect(html).toContain(">100.0%<");
  });
});
