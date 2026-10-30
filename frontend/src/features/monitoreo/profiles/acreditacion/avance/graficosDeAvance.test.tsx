import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { anchoPorDia, ANCHO_DE_ROTULO_DE_FECHA, DIAS_DE_LA_VENTANA, Minibarras, PASO_MAXIMO_POR_DIA, rotulosDeFecha } from "./graficosDeAvance";

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
  it("dos días con barras de tope llevan rótulo centrado y no se pisan", () => {
    const rotulos = rotulosDeFecha(2, PASO_MAXIMO_POR_DIA, false);
    // 44 px por día alcanzan para «29 oct» y «30 oct» centrados bajo su barra.
    expect(rotulos).toEqual([{ indice: 0, anclaje: "middle" }, { indice: 1, anclaje: "middle" }]);
  });

  it("con días anchos rotula todos, y si llenan el ancho ancla los extremos", () => {
    expect(rotulosDeFecha(3, 120, true)).toEqual([
      { indice: 0, anclaje: "start" }, { indice: 1, anclaje: "middle" }, { indice: 2, anclaje: "end" },
    ]);
  });

  it("muchos días angostos: un rótulo cada tanto, nunca más cerca que su ancho", () => {
    const rotulos = rotulosDeFecha(60, 10, true);
    const xs = rotulos.map((rotulo) => rotulo.indice * 10);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(ANCHO_DE_ROTULO_DE_FECHA);
    expect(rotulos[0].indice).toBe(0);
  });
});
