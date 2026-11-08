// Mata: una cabecera plegada que calla los ajustes propios de adentro, o que los cuenta dos veces.
import { describe, expect, it } from "vitest";
import { resumenPlegado } from "./resumenPlegado";

describe("resumen de la sección plegada", () => {
  it("sin propios no dice nada", () => {
    expect(resumenPlegado([])).toBeNull();
  });
  it("uno corto se nombra; uno largo o varios se cuentan, con la lista en el detalle", () => {
    expect(resumenPlegado(["Redondeo"])).toEqual({ texto: "Redondeo propio", detalle: "Sólo de este gráfico: Redondeo." });
    expect(resumenPlegado(["Resaltar en rojo bajo (%)"])?.texto).toBe("1 propio");
    expect(resumenPlegado(["Orden", "Máximo de categorías", "Orden"])).toEqual({
      texto: "2 propios", detalle: "Sólo de este gráfico: Orden, Máximo de categorías.",
    });
  });
});
