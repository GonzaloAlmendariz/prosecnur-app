// Mata: perder el envoltorio al cambiar la regla interior, tratar como condicionada un if() con otro «si no», y una
// condición sin regla que dejaría la restricción en if(…, , true()).
import { describe, expect, test } from "vitest";
import { escribirCondicionada, leerCondicionada } from "./condicionadaModelo";
import { escribirCuantas } from "./cuantasOpcionesModelo";

describe("regla condicionada", () => {
  test("separa condición y regla, y vuelve igual", () => {
    const raw = "if(${trabaja} = '1', . <= 80, true())";
    const l = leerCondicionada(raw);
    expect(l).toEqual({ condicion: "${trabaja} = '1'", regla: ". <= 80" });
    expect(escribirCondicionada(l.regla, l.condicion)).toBe(raw);
  });

  test("un if() que no termina en true() no es condicionada", () => {
    expect(leerCondicionada("if(${a} = 1, . > 0, . < 0)").condicion).toBe("");
    expect(leerCondicionada(". > 0")).toEqual({ condicion: "", regla: ". > 0" });
  });

  test("los demás armadores trabajan sobre la regla interior y el envoltorio se conserva", () => {
    const { condicion, regla } = leerCondicionada("if(selected(${medios}, '1'), count-selected(.) <= 3, true())");
    const nueva = escribirCuantas(regla, { modo: "maximo", min: null, max: 2 });
    expect(escribirCondicionada(nueva, condicion)).toBe("if(selected(${medios}, '1'), count-selected(.) <= 2, true())");
  });

  test("sin regla no queda nada; sin condición queda la regla", () => {
    expect(escribirCondicionada("", "${a} = 1")).toBe("");
    expect(escribirCondicionada(". > 0", "")).toBe(". > 0");
  });
});
