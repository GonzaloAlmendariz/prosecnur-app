// Mata: una batería table-list que sale como tarjetas sueltas, una grilla con listas distintas que pierde opciones y
// una nota de presentación que queda huérfana en la página anterior.
import { describe, expect, it } from "vitest";
import { parseBuilderStructure } from "../../parsing/buildIndex";
import type { ChoiceItem } from "../../types";
import { grillasDelFormulario, notasQueIntroducenGrilla, tituloSinRotulo } from "./modeloGrilla";

const fila = (type: string, name: string, label = "", appearance = "") => [type, name, label, appearance];
const survey = {
  columns: ["type", "name", "label", "appearance"],
  rows: [
    fila("begin_group", "secA", "Sección A"),
    fila("note", "intro", "¿Qué opina de cada fruta?"),
    fila("begin_group", "bateria", "", "table-list"),
    fila("select_one gusto", "manzana", "Manzana"),
    fila("select_one gusto", "pera", "Pera"),
    fila("end_group", ""),
    fila("begin_group", "mixta", "", "table-list"),
    fila("select_one gusto", "uva", "Uva"),
    fila("select_one otra", "kiwi", "Kiwi"),
    fila("end_group", ""),
    fila("begin_group", "suelta", "Sin grilla"),
    fila("select_one gusto", "mango", "Mango"),
    fila("end_group", ""),
    fila("end_group", ""),
  ],
};
const opciones: Record<string, ChoiceItem[]> = {
  gusto: [{ rowIndex: 0, name: "1", label: "Me gusta" }, { rowIndex: 1, name: "2", label: "No me gusta" }],
  otra: [{ rowIndex: 2, name: "x", label: "X" }],
};

describe("grillas en Probar", () => {
  const structure = parseBuilderStructure(survey);
  const grillas = grillasDelFormulario(structure, (l) => opciones[l] ?? []);
  const porNombre = (n: string) => Array.from(structure.sections.values()).find((s) => s.name === n)!.id;

  it("un table-list con la misma lista es grilla, con sus filas y columnas", () => {
    const g = grillas.get(porNombre("bateria"));
    expect(g?.filas.map((f) => f.name)).toEqual(["manzana", "pera"]);
    expect(g?.opciones.map((o) => o.label)).toEqual(["Me gusta", "No me gusta"]);
    expect(g?.multiple).toBe(false);
  });

  it("la nota de justo antes la presenta y deja de pintarse sola", () => {
    const g = grillas.get(porNombre("bateria"));
    expect(g?.intro?.name).toBe("intro");
    expect(notasQueIntroducenGrilla(grillas).has(g!.intro!.rowIndex)).toBe(true);
  });

  it("listas distintas o un grupo sin table-list no son grilla", () => {
    expect(grillas.has(porNombre("mixta"))).toBe(false);
    expect(grillas.has(porNombre("suelta"))).toBe(false);
    expect(grillas.get(porNombre("mixta"))).toBeUndefined();
  });

  it("una batería sin rótulo toma el de su sección y el código de su nota", () => {
    const g = grillas.get(porNombre("bateria"))!;
    expect(tituloSinRotulo("Sección A", g.intro)).toBe("Sección A");
    expect(tituloSinRotulo("Sección A", { ...g.intro!, label: "**A1.** ¿Qué opina?" })).toBe("Sección A (A1)");
    expect(tituloSinRotulo(null, g.intro)).toBe("Sección sin título");
  });
});
