import { describe, expect, it } from "vitest";
import { barrasDelCruce } from "../barrasDelCruce";
import { modeloCalor } from "../explorarModelo";

const TABLA = {
  filas: [{ codigo: "1", etiqueta: "Lima", n: 50 }, { codigo: "2", etiqueta: "Callao", n: 50 }],
  columnas: [{ codigo: "h", etiqueta: "Hombre", n: 40 }, { codigo: "m", etiqueta: "Mujer", n: 60 }],
  n: [[30, 20], [10, 40]],
};

describe("barras agrupadas del cruce", () => {
  it("una barra por columna con la lectura de la tabla y la diferencia en puntos", () => {
    const b = barrasDelCruce(modeloCalor(TABLA, "columna", 100))!;
    expect(b.series).toEqual([{ etiqueta: "Hombre", n: 40 }, { etiqueta: "Mujer", n: 60 }]);
    expect(b.filas[0].valores.map((v) => v.texto)).toEqual(["75.0", "33.3"]);
    expect(b.filas[0].dif).toEqual({ texto: "+41.7", destacada: true });
    // La barra más larga ocupa la pista entera; las demás, en proporción.
    expect(b.filas[1].valores[1].ancho).toBeCloseTo((100 * 66.667) / 75, 0);
  });

  it("en casos no hay diferencia en puntos; con una sola columna o más de cuatro, no hay barras", () => {
    expect(barrasDelCruce(modeloCalor(TABLA, "n", 100))!.filas[0].dif).toBeNull();
    expect(barrasDelCruce(modeloCalor({ ...TABLA, columnas: [TABLA.columnas[0]], n: [[30], [10]] }, "columna", 40))).toBeNull();
  });
});
