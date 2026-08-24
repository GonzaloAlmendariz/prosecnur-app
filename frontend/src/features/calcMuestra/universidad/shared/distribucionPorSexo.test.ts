import { describe, expect, it } from "vitest";

import { etiquetaDeSexo, universityDistributionRows } from "./study";
import { universityCategoryProfileRows } from "./categorias";
// El tipo vive en la capa de API, no en `study.ts`, que sólo lo reexporta para
// su propio uso.
import type { CalcMuestraComponente } from "../../../../api/calcMuestra";

/**
 * **Las dos columnas de la tabla de cuotas salían intercambiadas.**
 *
 * `sub_a` NO es «Mujeres»: `universityFrameFromRows` lo fija como **la
 * categoría de sexo más frecuente de la población** (`sexosOrdenados[0]`). En un
 * estudio de mayoría femenina coincide por casualidad; en uno de mayoría
 * masculina, no.
 *
 * Medido en HSVG2026 el 2026-08-23: el marco declara `sub_a_label = "M"`, la
 * distribución da ARQUITECTURA M=40 y F=85, y la tabla enseñaba «Mujeres 40 ·
 * Hombres 85». Invertidas, en la tabla que se marca «Incluir en reporte».
 *
 * Contrastado con el marco: Ciencias e Ingeniería tiene 535 aulas de mayoría
 * masculina y 43 femenina, y la tabla le asignaba 398 «mujeres».
 */
const comp = (subALabel: string, subBLabel: string) => ({
  tecnica: "prob_estratificado_independiente",
  parametros: { e: 0.025, p: 0.3 },
  marco: {
    estratos: [
      { label: "ARQUITECTURA Y URBANISMO", sub_a_label: subALabel, sub_b_label: subBLabel,
        e_facultad: 0.025, p_facultad: 0.3 },
    ],
  },
  resultado: {
    distribucion_estratos: [{ estrato: "ARQUITECTURA Y URBANISMO", N: 1092, n: 125 }],
    distribucion_sub: [
      { estrato: "ARQUITECTURA Y URBANISMO", sub: "M", N: 600, n: 40 },
      { estrato: "ARQUITECTURA Y URBANISMO", sub: "F", N: 492, n: 85 },
    ],
  },
} as unknown as CalcMuestraComponente);

describe("universityDistributionRows · cada sexo en su columna", () => {
  it("con sub_a = «M», las mujeres son las F", () => {
    const [fila] = universityDistributionRows(comp("M", "F"));
    expect(fila.mujeres).toBe(85);
    expect(fila.hombres).toBe(40);
  });

  it("y con sub_a = «F» da lo mismo: no depende del orden", () => {
    // El caso que funcionaba por casualidad. Tiene que seguir funcionando, y
    // por la razón correcta.
    const [fila] = universityDistributionRows(comp("F", "M"));
    expect(fila.mujeres).toBe(85);
    expect(fila.hombres).toBe(40);
  });

  it("la suma sigue cuadrando con la cuota del estrato", () => {
    const [fila] = universityDistributionRows(comp("M", "F"));
    expect(fila.mujeres + fila.hombres).toBe(fila.n);
  });
});

describe("etiquetaDeSexo", () => {
  it("reconoce los códigos y las palabras", () => {
    expect(etiquetaDeSexo("M")).toBe("Hombres");
    expect(etiquetaDeSexo("f")).toBe("Mujeres");
    expect(etiquetaDeSexo("Masculino")).toBe("Hombres");
    expect(etiquetaDeSexo("FEMENINO")).toBe("Mujeres");
    expect(etiquetaDeSexo("Mujeres")).toBe("Mujeres");
  });

  it("lo que no reconoce lo devuelve entero, sin inventarle sexo", () => {
    expect(etiquetaDeSexo("Sin dato")).toBe("Sin dato");
    expect(etiquetaDeSexo("X")).toBe("X");
    expect(etiquetaDeSexo("")).toBe("");
  });
});

/**
 * **Y los fallbacks sin población tenían el mismo defecto, latente.**
 *
 * Cuando el marco no trae filas de población, tres superficies caen a los
 * estratos y leen `N_a` como «mujeres»: el perfil de categorías, las tarjetas
 * del marco y el gráfico de barras por facultad. `N_a` es la categoría de sexo
 * MÁS FRECUENTE, así que en un estudio de mayoría masculina los tres pintarían
 * los sexos al revés — el mismo defecto que ya invirtió la tabla de cuotas,
 * esperando a un estudio sin población.
 */
describe("el fallback por estratos respeta la etiqueta de cada subgrupo", () => {
  const estratos = [
    { label: "CIENCIAS E INGENIERIA", N: 4623, N_a: 3400, N_b: 1223, sub_a_label: "M", sub_b_label: "F" },
    { label: "ARTE Y DISEÑO", N: 1045, N_a: 200, N_b: 845, sub_a_label: "M", sub_b_label: "F" },
  ];

  it("suma cada sexo por lo que su etiqueta dice, no por su posición", () => {
    const filas = universityCategoryProfileRows(
      [], ["sexo"], estratos as never, undefined,
    );
    const porLabel = Object.fromEntries(filas.map((f) => [f.label, f.value]));
    // Hombres = los «M» de las dos facultades: 3.400 + 200.
    expect(porLabel.Hombres).toBe(3600);
    expect(porLabel.Mujeres).toBe(2068);
  });

  it("y con el marco al revés da lo mismo, que es el punto", () => {
    const invertido = estratos.map((e) => ({
      ...e, N_a: e.N_b, N_b: e.N_a, sub_a_label: "F", sub_b_label: "M",
    }));
    const filas = universityCategoryProfileRows([], ["sexo"], invertido as never, undefined);
    const porLabel = Object.fromEntries(filas.map((f) => [f.label, f.value]));
    expect(porLabel.Hombres).toBe(3600);
    expect(porLabel.Mujeres).toBe(2068);
  });

  it("mujeres primero y hombres después, sin depender del array", () => {
    const filas = universityCategoryProfileRows([], ["sexo"], estratos as never, undefined);
    expect(filas.map((f) => f.label)).toEqual(["Mujeres", "Hombres"]);
  });
});
