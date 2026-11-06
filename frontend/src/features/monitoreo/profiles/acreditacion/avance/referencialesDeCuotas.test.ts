import { describe, expect, it } from "vitest";
import type { MonitoreoCuota } from "../../../../../api/monitoreoCuotas";
import { entradasSinCuota } from "../avanceCuotasModelo";
import { referencialesDeCuotas } from "./composicionModelo";

const categoria = (c: string, universo: number, efectivas: number, extra: Partial<MonitoreoCuota["categorias"][number]> = {}) => ({
  categoria: c, universo, meta: 0, efectivas, falta: 0, avance: null, tasa: null, estado: "sin_meta" as const,
  estado_cuota: "referencial", referencia: null, pct_efectivas: null, pct_universo: null, celda_vacia: false, ...extra,
});

const referencial: MonitoreoCuota = {
  id: "q-ref", actor: "Docentes", variable: "Dedicación", caracter: "referencial", cobertura: null, universo: 100,
  meta: 0, efectivas: 40, avance: null, categorias_cumplidas: 0, categorias_total: 0, sin_dato: 0, sin_dato_efectivas: 0,
  categorias: [
    categoria("TPA", 75, 30, { referencia: 25, pct_universo: 0.75, pct_efectivas: 0.75 }),
    categoria("DTC", 25, 10, { referencia: 8, pct_universo: 0.25, pct_efectivas: 0.25 }),
  ],
};
const meta: MonitoreoCuota = { ...referencial, id: "q-meta", variable: "Sexo", caracter: "meta", categorias: [] };

describe("acreditación: cuotas referenciales (ADR 0126)", () => {
  it("se leen como composición frente al universo, en puntos", () => {
    const [v] = referencialesDeCuotas([referencial, meta]);
    expect(v.id).toBe("q-ref");
    expect(v.filas.map((f) => [f.categoria, f.pctBase, f.pctEfectivas, f.delta])).toEqual([
      ["TPA", 75, 75, 0],
      ["DTC", 25, 25, 0],
    ]);
  });

  it("al guardar otra cuota, la referencial conserva sus números y su carácter", () => {
    const [entrada] = entradasSinCuota([referencial, meta], "q-meta");
    expect(entrada).toMatchObject({ id: "q-ref", caracter: "referencial", metas: { TPA: 25, DTC: 8 } });
  });
});
