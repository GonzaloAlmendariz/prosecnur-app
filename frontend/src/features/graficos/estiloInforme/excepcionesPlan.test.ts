// R5 (2026-10-15). Mata: una lista que omite un gráfico con regla propia en la segunda ranura, o que lista los que
// siguen la regla del informe.
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { opcionCasos } from "../laminas/CasosGrafico";
import { excepcionesDelPlan } from "./excepcionesPlan";

const g = (graficador: string, mostrar?: boolean) => ({ graficador, args: mostrar === undefined ? {} : { overrides: { mostrar_n_en_etiquetas: mostrar } } });
const slides = [
  { id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "Sexo", grafico: g("p_pie", true) } },
  { id: "b", tipo: "p_slide_2_graficos", payload: { titulo: "Grado", izquierda: g("p_pie"), derecha: g("p_donut", false) } },
  { id: "c", tipo: "p_slide_1_grafico", payload: { titulo: "Ciclo", grafico: g("p_barras_agrupadas") } },
] as unknown as Slide[];

describe("gráficos con regla propia", () => {
  it("lista sólo los que se apartan, con su lámina y su valor", () => {
    const leer = (_: string, args: Record<string, unknown>) => ({ siempre: "Siempre", nunca: "Nunca", informe: null })[opcionCasos(args)];
    const r = excepcionesDelPlan(slides, leer, (s) => String((s.payload as Record<string, unknown>).titulo));
    expect(r.map((e) => `L${e.posicion} ${e.titulo} ${e.valor}`)).toEqual(["L1 Sexo Siempre", "L2 Grado Nunca"]);
  });
});

import { nombresPropiosDeBase } from "./excepcionesPlan";
import { parseBaseLabels } from "../laminas/datosBase/nombresPorBaseModel";

describe("nombres propios de las bases en un gráfico", () => {
  it("dice qué nombre reemplaza a cuál y calla si no hay o si es el mismo", () => {
    expect(nombresPropiosDeBase({ tabla_encabezados: "docentes=Profesores\nestudiantes=" }, parseBaseLabels)).toBe("“Profesores” en vez de “docentes”");
    expect(nombresPropiosDeBase({ tabla_encabezados: "estudiantes_2018=Estudiantes 2018" }, parseBaseLabels)).toBeNull();
    expect(nombresPropiosDeBase({}, parseBaseLabels)).toBeNull();
  });
});
