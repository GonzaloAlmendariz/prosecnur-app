/**
 * Toda dimensión que el motor balancea llega al usuario en español.
 *
 * `selectorFieldLabel` tenía tres entradas —faculty, sex_top_1, size_group—
 * mientras el motor balancea siete (`api/R/calc_muestra_aulas.R:294`). `program`
 * y `level` llegaban crudos a la tabla de balance y nadie lo veía, porque esa
 * tabla mostraba siempre las diez primeras filas y todas eran de facultad.
 */
import { describe, expect, it } from "vitest";
import { selectorFieldLabel, selectorFieldLabelTitulo } from "../classroomLabels";

// Copia literal de la lista de `dimension` del motor R.
const DIMENSIONES_DEL_MOTOR = [
  "faculty", "program", "level", "schedule", "modality", "size_group", "sex",
];

describe("las dimensiones del balance no llegan crudas", () => {
  it("las siete del motor tienen traducción", () => {
    for (const dim of DIMENSIONES_DEL_MOTOR) {
      expect(selectorFieldLabel(dim), `sin traducir: ${dim}`).not.toBe(dim);
    }
  });

  it("la variante de tabla capitaliza en español", () => {
    expect(selectorFieldLabelTitulo("program")).toBe("Programa");
    expect(selectorFieldLabelTitulo("level")).toBe("Nivel o ciclo");
  });

  it("`sex_top_1`, que es como llega en las filas, también traduce", () => {
    // El motor declara la dimensión como `sex` pero la columna del aula es
    // `sex_top_1`, y a la tabla llega esta última.
    expect(selectorFieldLabel("sex_top_1")).toBe("sexo esperado");
  });

  it("una dimensión desconocida se devuelve tal cual, sin inventar", () => {
    expect(selectorFieldLabel("campus_futuro")).toBe("campus_futuro");
  });
});
