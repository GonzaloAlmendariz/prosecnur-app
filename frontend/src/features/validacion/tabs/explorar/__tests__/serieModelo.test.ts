import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { ExploradorCrucePunto } from "../../../../../api/validacionExplorar";
import CruceSerie from "../CruceSerie";
import { barrasApiladas, casosPorDia, modoDeSerie, ordenDeSeries, pctDelPeriodo, rangoDeDias } from "../serieModelo";

const p = (fecha: string, valor: number, serie: string | null, n: number | null = null, baja: number | null = null, alta: number | null = null): ExploradorCrucePunto => ({
  fecha, valor, baja, alta, serie, n,
});

describe("serie por fecha del cruce (E8j, E8k, E8l, E8i)", () => {
  it("el modo sale del par: única apila, múltiple en %, numérica mediana — también fecha × numérica", () => {
    expect(modoDeSerie("so")).toBe("apilada");
    expect(modoDeSerie("sm")).toBe("porcentaje");
    expect(modoDeSerie("num")).toBe("mediana");
    expect(modoDeSerie("fecha", "num")).toBe("mediana");
  });

  it("las barras apiladas suman los casos del día, de la categoría que más pesa a la que menos, «Otro» al final", () => {
    const { fechas, series, barras, max } = barrasApiladas([
      p("2026-06-14", 3, "Mujer"), p("2026-06-13", 6, "Hombre"), p("2026-06-13", 2, "Mujer"), p("2026-06-14", 0, "Hombre"),
      p("2026-06-13", 9, "Otro"),
    ]);
    expect(fechas).toEqual(["2026-06-13", "2026-06-14"]);
    expect(series).toEqual(["Hombre", "Mujer", "Otro"]);
    expect(barras[0].total).toBe(17);
    expect(barras[0].tramos.map((t) => [t.serie, t.desde, t.hasta])).toEqual([["Hombre", 0, 6], ["Mujer", 6, 8], ["Otro", 8, 17]]);
    expect(max).toBe(17);
  });

  it("en %, el orden y el rótulo son el % del periodo, ponderado por los casos de cada día", () => {
    const puntos = [p("2026-06-13", 40, "Radio", 10), p("2026-06-14", 20, "Radio", 40), p("2026-06-13", 70, "Redes", 10), p("2026-06-14", 60, "Redes", 40)];
    expect(ordenDeSeries(puntos, "porcentaje")).toEqual(["Redes", "Radio"]);
    expect(pctDelPeriodo(puntos, "Radio")).toBe(24);   // (40·10 + 20·40) / 50
    // Revisión metodológica: un día de 1 caso al 100 % y otro de 99 al 0 % dan 1 %, no 50 %.
    expect(pctDelPeriodo([p("2026-06-13", 100, "Radio", 1), p("2026-06-14", 0, "Radio", 99)], "Radio")).toBe(1);
    expect([...casosPorDia(puntos).entries()]).toEqual([["2026-06-13", 10], ["2026-06-14", 40]]);
  });

  it("la única se dibuja como barras apiladas con el eje de fechas de Monitoreo y el día mayor rotulado", () => {
    const html = renderToStaticMarkup(createElement(CruceSerie, {
      modo: "apilada",
      puntos: [p("2026-06-30", 5, "Hombre"), p("2026-06-30", 2, "Mujer"), p("2026-07-01", 3, "Hombre"), p("2026-07-01", 0, "Mujer")],
    }));
    expect(html.match(/class="vx-svg-barra"/g)?.length).toBe(3);
    expect(html).toContain("30 jun: 7 casos");
    expect(html).toContain(">7, 30 jun<");
    expect(html).toMatch(/mon-eje-fecha is-mes[^>]*>jun</);
    expect(html).toMatch(/mon-eje-fecha is-mes[^>]*>jul</);
  });

  it("la múltiple va en un panel por opción, cada uno con su tope; los días chicos se marcan", () => {
    const html = renderToStaticMarkup(createElement(CruceSerie, {
      modo: "porcentaje",
      puntos: [p("2026-06-13", 40, "Radio", 50), p("2026-06-14", 12.5, "Radio", 8), p("2026-06-13", 63, "Redes", 50), p("2026-06-14", 70, "Redes", 8)],
    }));
    expect(html.match(/class="vx-multiple( is-mayor)?"/g)?.length).toBe(2);
    expect(html).toContain("vx-multiple is-mayor");
    expect(html).toContain(">80%<");
    expect(html).toContain(">40%<");
    expect(html.match(/class="vx-svg-dia-chico"/g)?.length).toBe(2);
    expect(html).toContain("Día con menos de 30 casos");
  });

  it("la numérica dibuja la mediana con su mitad central y deja hueco el día de pocos casos", () => {
    const html = renderToStaticMarkup(createElement(CruceSerie, {
      modo: "mediana",
      puntos: [p("2026-06-13", 40, null, 120, 30, 52), p("2026-06-14", 38, null, 12, 29, 50)],
    }));
    expect(html).toContain("vx-svg-banda-central");
    expect(html.match(/vx-svg-nodo-mediana is-chico/g)?.length).toBe(1);
    expect(html).toContain("Mitad central (p25 a p75)");
  });

  it("un día sin casos queda como hueco: el eje no lo salta y la mediana no lo cruza", () => {
    expect(rangoDeDias(["2026-06-30", "2026-06-28"])).toEqual(["2026-06-28", "2026-06-29", "2026-06-30"]);
    const { barras } = barrasApiladas([p("2026-06-28", 4, "Hombre"), p("2026-06-30", 2, "Hombre")]);
    expect(barras.map((b) => [b.fecha, b.total])).toEqual([["2026-06-28", 4], ["2026-06-29", 0], ["2026-06-30", 2]]);
    const html = renderToStaticMarkup(createElement(CruceSerie, {
      modo: "mediana",
      puntos: [p("2026-06-27", 40, null, 50, 30, 52), p("2026-06-28", 41, null, 50, 30, 52), p("2026-06-30", 38, null, 50, 29, 50)],
    }));
    expect(html.match(/class="vx-svg-traza"/g)?.length).toBe(2);
    expect(html).toMatch(/mon-eje-fecha"[^>]*>29</);
  });
});
