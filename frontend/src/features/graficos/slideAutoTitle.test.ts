import { describe, expect, test } from "vitest";
import type { Slide, VarInfo } from "../../api/client";
import {
  cleanInferredVariableTitle,
  inferSlideVariableTitle,
  resolveSlideTitle,
  slideDisplayTitle,
} from "./slideAutoTitle";

type VarFixture = VarInfo & { source?: string };

const variables: VarFixture[] = [
  {
    source: "trabajadores",
    name: "p2_recod",
    label: "Edad (Recodificada)",
    tipo: "select_one",
    seccion: "",
  },
  {
    source: "trabajadores",
    name: "q0005",
    label: "Se implementan acciones concretas para promover la igualdad de genero entre hombres y mujeres",
    tipo: "select_one",
    seccion: "",
  },
];

function oneChartSlide(payload: Record<string, unknown>): Slide {
  return {
    id: "s-1",
    tipo: "p_slide_1_grafico",
    payload,
  };
}

describe("slideAutoTitle", () => {
  test("limpia sufijo Recodificada solo en titulos inferidos", () => {
    expect(cleanInferredVariableTitle("Edad (Recodificada)")).toBe("Edad");
    expect(cleanInferredVariableTitle("Edad")).toBe("Edad");
  });

  test("usa el titulo manual si el usuario lo escribio", () => {
    const slide = oneChartSlide({
      titulo: "Titulo manual",
      grafico: {
        graficador: "p_barras_agrupadas",
        args: { var: "trabajadores$p2_recod" },
      },
    });

    expect(resolveSlideTitle(slide, variables)).toEqual({
      title: "Titulo manual",
      source: "manual",
    });
  });

  test("infiera el titulo desde el label de la variable en slides de un grafico", () => {
    const slide = oneChartSlide({
      titulo: "",
      grafico: {
        graficador: "p_barras_apiladas",
        args: { var: "trabajadores$q0005" },
      },
    });

    expect(inferSlideVariableTitle(slide, variables)).toEqual({
      title: variables[1].label,
      source: "variable",
      variableRef: "trabajadores$q0005",
    });
    expect(slideDisplayTitle(slide, variables)).toBe(variables[1].label);
  });

  test("no fuerza titulo automatico en slides con varios graficos", () => {
    const slide: Slide = {
      id: "s-2",
      tipo: "p_slide_2_graficos",
      payload: {
        titulo: "",
        izquierda: {
          graficador: "p_barras_agrupadas",
          args: { var: "trabajadores$q0005" },
        },
      },
    };

    expect(inferSlideVariableTitle(slide, variables).source).toBe("none");
    expect(slideDisplayTitle(slide, variables, "Dos graficos")).toBe("Dos graficos");
  });
});
