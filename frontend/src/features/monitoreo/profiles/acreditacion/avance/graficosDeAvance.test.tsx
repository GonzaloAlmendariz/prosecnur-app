import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { anchoPorDia, ANCHO_DEL_DIA, ejeDeFechas, DIAS_DE_LA_VENTANA, Minibarras, PASO_MAXIMO_POR_DIA, rotulosDeFecha } from "./graficosDeAvance";

describe("Avance › una barra es un día", () => {
  it("el primer día de campo no ocupa la ventana de 14 días entera", () => {
    expect(anchoPorDia(700, 1, { ranuras: DIAS_DE_LA_VENTANA })).toBe(50);
    expect(anchoPorDia(700, 14, { ranuras: DIAS_DE_LA_VENTANA })).toBe(50);
    expect(anchoPorDia(700, 28, { ranuras: DIAS_DE_LA_VENTANA })).toBe(25);
  });

  it("en todo el campo el día tiene tope y se encoge cuando hay muchos", () => {
    expect(anchoPorDia(900, 1, { tope: PASO_MAXIMO_POR_DIA })).toBe(PASO_MAXIMO_POR_DIA);
    expect(anchoPorDia(900, 60, { tope: PASO_MAXIMO_POR_DIA })).toBe(15);
  });

  it("la miniatura de 14 días dibuja un solo día como una casilla de catorce", () => {
    const html = renderToStaticMarkup(<Minibarras valores={[12]} etiqueta="Efectivas" />);
    const ancho = Number(/<rect[^>]*width="([\d.]+)"/.exec(html)?.[1]);
    expect(ancho).toBeCloseTo((84 / 14) * 0.7, 5);
  });
});

describe("Avance › rótulos de fecha que no se montan", () => {
  it("dos días con barras de tope llevan rótulo y no se pisan", () => {
    expect(rotulosDeFecha(2, PASO_MAXIMO_POR_DIA)).toEqual([{ indice: 0 }, { indice: 1 }]);
  });

  it("con días anchos rotula todos", () => {
    expect(rotulosDeFecha(3, 120)).toEqual([{ indice: 0 }, { indice: 1 }, { indice: 2 }]);
  });

  it("el eje lleva el día en cada barra y el mes sólo donde empieza", () => {
    const fechas = ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"];
    expect(ejeDeFechas(fechas, PASO_MAXIMO_POR_DIA)).toEqual([
      { indice: 0, dia: "29", mes: "oct" }, { indice: 1, dia: "30", mes: null }, { indice: 2, dia: "31", mes: null },
      { indice: 3, dia: "1", mes: "nov" }, { indice: 4, dia: "2", mes: null },
    ]);
  });

  it("dos meses demasiado juntos dejan sólo el más nuevo", () => {
    const rotulos = ejeDeFechas(["2026-10-31", "2026-11-01", "2026-11-02"], 20);
    expect(rotulos.map((rotulo) => rotulo.mes)).toEqual([null, "nov", null]);
  });

  it("muchos días angostos: un rótulo cada tanto, nunca más cerca que su ancho", () => {
    const rotulos = rotulosDeFecha(60, 10);
    const xs = rotulos.map((rotulo) => rotulo.indice * 10);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(ANCHO_DEL_DIA);
    expect(rotulos[0].indice).toBe(0);
  });
});
