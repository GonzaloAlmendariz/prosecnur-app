import { describe, expect, it } from "vitest";
import type { VarWithSource } from "../../useVariables";
import { conCorte, conNombre, conTemas, corteDe, escalaDe, faltaEnMatriz, nombreDePartida, nombresDe, temasDe } from "./modeloMatrizCuadrantes";

const v = (source: string, name: string, label: string, choices: [string, string][] = []): VarWithSource =>
  ({ source, name, label, tipo: "select_one", seccion: "", choices: choices.map(([n, l]) => ({ name: n, label: l })) }) as VarWithSource;
const vars = [v("docentes", "p12_1", "Servicio de salud", [["4", "Satisfecho"], ["5", "Muy satisfecho"]]),
  v("estudiantes", "p12_1", "Servicio de salud", [["4", "Satisfecho"], ["5", "Muy satisfecho"]]), v("docentes", "p12_2", "Bienestar")];

describe("la tarjeta de la matriz de cuadrantes (G16)", () => {
  it("un tema nuevo parte de la etiqueta de su pregunta y guarda sus dos refs con base", () => {
    expect(nombreDePartida(vars, "docentes$p12_1")).toBe("Servicio de salud");
    const a = conTemas(vars, [{ nombre: "Salud", x: "docentes$p12_1", y: "estudiantes$p12_1" }, { nombre: "Salud", x: "docentes$p12_2", y: "" }]);
    expect(a.temas).toEqual({ Salud: ["docentes$p12_1", "estudiantes$p12_1"], "Salud 2": ["docentes$p12_2", ""] });
    expect(temasDe(a).map((t) => t.nombre)).toEqual(["Salud", "Salud 2"]);
    expect(escalaDe(vars, temasDe(a), "x").map((o) => o.etiqueta)).toEqual(["Satisfecho", "Muy satisfecho"]);
  });

  it("pide, en orden, dos temas completos y las respuestas de cada eje", () => {
    let a: Record<string, unknown> = conTemas(vars, [{ nombre: "Salud", x: "docentes$p12_1", y: "estudiantes$p12_1" }]);
    expect(faltaEnMatriz(a)).toMatch(/dos temas/);
    a = conTemas(vars, [{ nombre: "A", x: "docentes$p12_1", y: "estudiantes$p12_1" }, { nombre: "B", x: "docentes$p12_2", y: "" }]);
    expect(faltaEnMatriz(a)).toMatch(/vertical/);
    a = conTemas(vars, [{ nombre: "A", x: "docentes$p12_1", y: "estudiantes$p12_1" }, { nombre: "B", x: "docentes$p12_2", y: "estudiantes$p12_1" }]);
    expect(faltaEnMatriz(a)).toMatch(/cada eje/);
    a = { ...a, ...conCorte(a, "x", "4", true), ...conCorte(a, "y", "5", true) };
    expect(corteDe(a, "x")).toEqual(["4"]); expect(faltaEnMatriz(a)).toBeNull();
  });

  it("un nombre de cuadrante vacío vuelve al neutro del motor", () => {
    let a: Record<string, unknown> = conNombre({}, "arriba_izq", "Prioridad");
    expect(nombresDe(a)).toEqual({ arriba_izq: "Prioridad" });
    a = conNombre(a, "arriba_izq", " ");
    expect(nombresDe(a)).toEqual({});
  });
});
