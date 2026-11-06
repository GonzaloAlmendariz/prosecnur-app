import { describe, expect, it } from "vitest";
import { ejeDeFechas, ticksDeFechas } from "./ejeDeFechas";

describe("Monitoreo › eje de fechas de dos líneas", () => {
  const fechas = ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"];

  it("el día en cada barra y el mes sólo donde empieza", () => {
    expect(ejeDeFechas(fechas, 44).map((r) => [r.dia, r.mes])).toEqual([["29", "oct"], ["30", null], ["31", null], ["1", "nov"], ["2", null]]);
  });

  it("lee también fechas día/mes/año y deja pasar lo que no es fecha", () => {
    expect(ejeDeFechas(["29/10/2026", "Sin fecha"], 44).map((r) => [r.dia, r.mes])).toEqual([["29", "oct"], ["Sin fecha", null]]);
  });

  it("para Plotly el mes va en la segunda línea", () => {
    expect(ticksDeFechas(fechas.slice(2, 4), 44)).toEqual({ tickvals: [0, 1], ticktext: ["31<br><b>oct</b>", "1<br><b>nov</b>"] });
  });
});
