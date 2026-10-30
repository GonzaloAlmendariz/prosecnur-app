import { describe, expect, test } from "vitest";
import type { PopulationPlan } from "../../../../api/hojasRuta";
import { rango } from "./rangos";
import { agruparFilas, resumirMatriz } from "./matriz";

const rangos = [rango(18, 29), rango(30, null)];
const plan = {
  ok: true,
  config: { age_ranges: rangos },
  cells: [
    { territorio: "ATE", ubigeo: "150103", poblacion: 68184, rango_edad: "18-29", rango_id: "18_29", sexo: "Hombre" },
    { territorio: "ATE", ubigeo: "150103", poblacion: 70000, rango_edad: "18-29", rango_id: "18_29", sexo: "Mujer" },
    { territorio: "ATE", ubigeo: "150103", poblacion: 100, rango_edad: "30+", rango_id: "30", sexo: "Mujer" },
  ],
} as unknown as PopulationPlan;

describe("matriz poblacional", () => {
  test("suma por rango, por distrito y separa hombres de mujeres", () => {
    const r = resumirMatriz(plan, rangos);
    expect(r.vigente).toBe(true);
    expect(r.pesoPorRango).toEqual([138184, 100]);
    expect(r.porUbigeo).toEqual({ "150103": 138284 });
    expect(r.filas[0].porRango[0]).toEqual({ H: 68184, M: 70000 });
  });

  test("si los rangos cambiaron, la matriz no está vigente", () => {
    expect(resumirMatriz(plan, [rango(18, 34), rango(35, null)]).vigente).toBe(false);
    expect(resumirMatriz(null, rangos)).toMatchObject({ vigente: false, total: 0 });
  });
});

describe("agruparFilas", () => {
  const fila = (ubigeo: string, h: number, m: number) => ({ ubigeo, territorio: ubigeo, porRango: [{ H: h, M: m }], total: h + m });
  const filas = [fila("150103", 10, 12), fila("150132", 5, 5), fila("070101", 3, 4)];

  test("por distrito deja las filas como están", () => {
    expect(agruparFilas(filas, "distrito")).toHaveLength(3);
  });

  test("por provincia suma Lima y Callao sin perder población", () => {
    const g = agruparFilas(filas, "provincia");
    expect(g.map((f) => [f.territorio, f.total])).toEqual([["Lima", 32], ["Callao", 7]]);
    expect(g[0].porRango[0]).toEqual({ H: 15, M: 17 });
  });

  test("por provincia, un distrito de Arequipa no cae en «Lima»", () => {
    const g = agruparFilas([...filas, fila("040103", 2, 2)], "provincia");
    expect(g.map((f) => f.territorio)).toEqual(["Lima", "Callao", "Arequipa"]);
  });

  test("por zona usa las zonas dadas y manda el resto a «Otros»", () => {
    const g = agruparFilas(filas, "zona", [{ etiqueta: "Este", ubigeos: ["150103", "150132"] }]);
    expect(g.map((f) => [f.territorio, f.total])).toEqual([["Este", 32], ["Otros", 7]]);
  });
});
