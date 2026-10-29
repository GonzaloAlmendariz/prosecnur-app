import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { anchoPorDia, DIAS_DE_LA_VENTANA, Minibarras, PASO_MAXIMO_POR_DIA } from "./graficosDeAvance";

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
