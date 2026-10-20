import { describe, expect, test } from "vitest";
import { tituloDeFilaRegla } from "./PestanaReglas";

describe("tituloDeFilaRegla", () => {
  test("une número, etiqueta legible y resumen para la fila cortada", () => {
    expect(tituloDeFilaRegla({ numero: "10b", titulo: "**¿Cuántos** años\ntiene?", resumen: "Entre 18 y 99" }))
      .toBe("10b ¿Cuántos años tiene? — Entre 18 y 99");
  });
  test("sin número ni resumen deja sólo la etiqueta", () => {
    expect(tituloDeFilaRegla({ numero: "", titulo: "edad_calc", resumen: "" })).toBe("edad_calc");
  });
});
