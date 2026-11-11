import { describe, expect, it } from "vitest";
import type { DataReviewVariable } from "../../../api/analitica";
import { codigoVisible, conEtiquetas, indiceDeEtiquetas } from "./etiquetasDeCategorias";

const variable = (name: string, opciones: [string, string][]): DataReviewVariable => ({
  name, tipo_xlsform: "select_one", seccion: "", included: true, label_actual: name, label_original: name,
  n_non_missing: 0, n_missing: 0, opciones: opciones.map(([code, label]) => ({ code, label, count: 0 })),
});

describe("Ponderación: etiquetas de las categorías", () => {
  const indice = indiceDeEtiquetas([
    variable("sexo", [["1", "Hombre"], ["2", "Mujer"]]),
    variable("edad", []),
    variable("zona", [["1", " "]]),
  ]);

  it("el índice va por variable y por código, y omite lo que no tiene etiqueta", () => {
    expect(indice).toEqual({ sexo: { "1": "Hombre", "2": "Mujer" } });
  });

  it("una base que solo guarda códigos se lee con las etiquetas del formulario", () => {
    const leidas = conEtiquetas([{ value: "1", label: "1" }, { value: "2", label: "" }], indice.sexo);
    expect(leidas).toEqual([{ value: "1", label: "Hombre" }, { value: "2", label: "Mujer" }]);
  });

  it("el código no cambia nunca: es la llave del cruce y de las metas", () => {
    // Las etiquetas del formulario llegan en otro orden que los valores de la columna.
    const alReves = { "2": "Mujer", "1": "Hombre" };
    const leidas = conEtiquetas([{ value: "1", label: "1" }, { value: "2", label: "2" }], alReves);
    expect(leidas.map((c) => c.value)).toEqual(["1", "2"]);
    expect(leidas.map((c) => c.label)).toEqual(["Hombre", "Mujer"]);
  });

  it("manda la etiqueta que la base trae pegada a la columna", () => {
    expect(conEtiquetas([{ value: "1", label: "Varón" }], indice.sexo)).toEqual([{ value: "1", label: "Varón" }]);
  });

  it("sin etiqueta en ningún lado queda el código, no un vacío", () => {
    expect(conEtiquetas([{ value: "9", label: "" }], indice.sexo)).toEqual([{ value: "9", label: "9" }]);
    expect(conEtiquetas([{ value: "1", label: "1" }], undefined)).toEqual([{ value: "1", label: "1" }]);
  });

  it("el código se muestra solo cuando dice algo distinto de la etiqueta", () => {
    expect(codigoVisible({ value: "1", label: "Hombre" })).toBe("1");
    expect(codigoVisible({ value: "1", label: "1" })).toBeNull();
    expect(codigoVisible({ value: "ate", label: "" })).toBeNull();
  });
});
