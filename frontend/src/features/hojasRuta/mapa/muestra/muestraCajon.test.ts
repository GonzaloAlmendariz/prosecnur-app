import { describe, expect, it } from "vitest";
import type { QuotaPlan } from "../../../../api/hojasRuta";
import { pivotarCuotas } from "./MuestraCajon";

describe("pivotarCuotas", () => {
  it("suma por rango y por sexo sin perder el total del distrito", () => {
    const cuotas = {
      cells: [
        { territorio: "Ate", rango_edad: "18-29", sexo: "Hombre", cuota: 10 },
        { territorio: "Ate", rango_edad: "18-29", sexo: "Mujer", cuota: 12 },
        { territorio: "Ate", rango_edad: "30+", sexo: "Hombre", cuota: 8 },
        { territorio: "Comas", rango_edad: "30+", sexo: "Mujer", cuota: 5 },
      ],
    } as unknown as QuotaPlan;
    const { rangos, sexos, filas } = pivotarCuotas(cuotas);
    expect(rangos).toEqual(["18-29", "30+"]);
    expect(sexos).toEqual(["Hombre", "Mujer"]);
    expect(filas[0]).toEqual({ territorio: "Ate", porRango: { "18-29": 22, "30+": 8 }, porSexo: { Hombre: 18, Mujer: 12 }, total: 30 });
    expect(filas[1].total).toBe(5);
  });

  it("sin sexo no inventa columnas", () => {
    const { sexos, filas } = pivotarCuotas({ cells: [{ territorio: "Ate", rango_edad: "18-29", sexo: null, cuota: 4 }] } as unknown as QuotaPlan);
    expect(sexos).toEqual([]);
    expect(filas[0].total).toBe(4);
  });

  it("sin cuotas devuelve vacío", () => {
    expect(pivotarCuotas(null).filas).toEqual([]);
  });
});

describe("P4: cuotas antes de sortear", () => {
  it("sin cuotas y con quien las calcule, se ofrece calcularlas", async () => {
    const { ofreceCalcularCuotas } = await import("./MuestraCajon");
    expect(ofreceCalcularCuotas(null, () => undefined)).toBe(true);
    expect(ofreceCalcularCuotas({ cells: [] } as unknown as QuotaPlan, () => undefined)).toBe(false);
    expect(ofreceCalcularCuotas(null, undefined)).toBe(false);
  });
});
