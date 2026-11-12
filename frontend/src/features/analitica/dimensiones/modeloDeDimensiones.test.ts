import { describe, expect, it } from "vitest";

import type { DimensionesCobertura, DimensionesEscalaDetectada } from "../../../api/dashboard";
import { DEFAULT_CONFIG, type DimensionesConfig } from "../store";
import {
  cifrasDeDimensiones,
  entradaElegida,
  entradasDeDimensiones,
  listasDeLaEntrada,
  preguntasDeLaEntrada,
  preguntasSinBloque,
} from "./modeloDeDimensiones";

// Estructura y cobertura de acnur_acg calculadas por el motor (`.dimensiones_construir` y `.dimensiones_preview`).
const DIM: DimensionesConfig = {
  ...DEFAULT_CONFIG.dimensiones,
  listas_objetivo: ["likert"],
  prefijo: "r100_",
  subindices: [
    { nombre: "legitimidad", etiqueta: "Legitimidad", vars: ["r100_A1_leg", "r100_A2_leg_inv"] },
    { nombre: "integracion", etiqueta: "Integración", vars: ["r100_A3_int", "r100_A4_eco"] },
    { nombre: "convivencia", etiqueta: "Convivencia", vars: ["r100_B1_coex"] },
  ],
  indices: [{ nombre: "cohesion", etiqueta: "Cohesión social", subindices: ["legitimidad", "integracion", "no_existe"] }],
};
const cob = (v: string, media: number): DimensionesCobertura => ({ var: v, n: 1283, n_validos: 1283, pct_validos: 100, media, sd: 11 });
const COBERTURA = [cob("idx_cohesion", 60.6), cob("sub_legitimidad", 75.3), cob("sub_integracion", 55.5), cob("sub_convivencia", 51.1)];
const ESCALAS: DimensionesEscalaDetectada[] = [
  { list_name: "likert", n: 6, vars: ["A1_leg", "A2_leg_inv", "A3_int", "A4_eco", "B1_coex", "E6_impact"], choices: [], es_default_evaluativa: false },
  { list_name: "yesno", n: 1, vars: ["consent"], choices: [], es_default_evaluativa: false },
];

describe("entradas de Dimensiones", () => {
  it("cruza la cobertura por el nombre de la columna, no por la posición", () => {
    const [indice, suelto] = entradasDeDimensiones(DIM, [...COBERTURA].reverse());
    expect(indice.columna).toBe("idx_cohesion");
    expect(indice.cobertura?.media).toBe(60.6);
    expect(indice.bloques.map((b) => [b.columna, b.cobertura?.media])).toEqual([["sub_legitimidad", 75.3], ["sub_integracion", 55.5]]);
    expect(suelto).toMatchObject({ tipo: "bloque", columna: "sub_convivencia" });
    expect(suelto.cobertura?.media).toBe(51.1);
  });

  it("omite el bloque que el índice nombra y no existe, y quita el prefijo a las preguntas", () => {
    const [indice] = entradasDeDimensiones(DIM, COBERTURA);
    expect(indice.bloques).toHaveLength(2);
    expect(preguntasDeLaEntrada(indice)).toEqual(["A1_leg", "A2_leg_inv", "A3_int", "A4_eco"]);
  });

  it("sin cobertura de una columna no inventa el puntaje", () => {
    const [indice] = entradasDeDimensiones(DIM, COBERTURA.filter((c) => c.var !== "idx_cohesion"));
    expect(indice.cobertura).toBeNull();
  });

  it("el rótulo guardado aparte manda sobre la etiqueta del bloque", () => {
    const [indice] = entradasDeDimensiones({ ...DIM, labels_indices: { cohesion: "Cohesión" } }, COBERTURA);
    expect(indice.etiqueta).toBe("Cohesión");
  });

  it("el foco elige por columna y, si no existe, cae a la primera", () => {
    const entradas = entradasDeDimensiones(DIM, COBERTURA);
    expect(entradaElegida(entradas, "sub_convivencia")?.columna).toBe("sub_convivencia");
    expect(entradaElegida(entradas, "idx_viejo")?.columna).toBe("idx_cohesion");
    // Con otro índice delante, el bloque lleva a su índice y no al primero.
    const dos = entradasDeDimensiones({ ...DIM, indices: [{ nombre: "otro", etiqueta: "Otro", subindices: ["convivencia"] }, ...DIM.indices] }, COBERTURA);
    expect(entradaElegida(dos, "sub_integracion")?.columna).toBe("idx_cohesion");
    expect(entradaElegida([], null)).toBeNull();
  });
});

describe("preguntas de escala y cifras", () => {
  it("las preguntas de las listas elegidas que no están en un bloque", () => {
    expect(preguntasSinBloque(DIM, ESCALAS)).toEqual(["E6_impact"]);
    expect(preguntasSinBloque({ ...DIM, excluir_vars: ["E6_impact"] }, ESCALAS)).toEqual([]);
  });

  it("las listas de una entrada salen de sus preguntas", () => {
    const [indice] = entradasDeDimensiones(DIM, COBERTURA);
    expect(listasDeLaEntrada(indice, ESCALAS)).toEqual(["likert"]);
  });

  it("numerador y base de las preguntas de escala sobre el mismo conjunto", () => {
    expect(cifrasDeDimensiones(DIM, ESCALAS)).toEqual({ indices: 1, bloques: 3, preguntasEnBloque: 5, preguntasDeEscala: 6 });
    expect(cifrasDeDimensiones(DIM, null)).toEqual({ indices: 1, bloques: 3, preguntasEnBloque: 5, preguntasDeEscala: null });
    // Una pregunta de otra lista dentro de un bloque no infla el numerador sobre la base.
    const conOtra = { ...DIM, subindices: [...DIM.subindices, { nombre: "x", etiqueta: "X", vars: ["r100_consent"] }] };
    expect(cifrasDeDimensiones(conOtra, ESCALAS)).toMatchObject({ preguntasEnBloque: 5, preguntasDeEscala: 6 });
  });
});
