// E19 paso 5: «lo marcado antes» y «según un número» se crean desde el asistente y se releen con la misma forma.
// Mata: escribir `selected(${q}, 'name')` (con comillas) en vez de la columna name, una comparación que no crea su
// columna, y un filtro que al abrirlo cae en «Escribir la expresión».
import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { escribirIntento, formaDe, intentoCompleto, leerComparacion } from "./escrituraFiltros";
import { intentoInicial } from "./IntencionFiltro";
import { analizarFiltro, nombreDeTipo } from "./modeloFiltros";
import { parseBuilderStructure } from "../parsing/buildIndex";

const wb: XlsformEditorWorkbook = {
  survey: {
    columns: ["type", "name", "label", "choice_filter"],
    rows: [
      ["integer", "edad", "Edad", ""],
      ["select_multiple medios", "usa", "¿Qué medios usa?", ""],
      ["select_one medios", "principal", "¿Cuál es el principal?", ""],
      ["select_one cargo", "cargo", "Cargo", ""],
    ],
  },
  choices: {
    columns: ["list_name", "name", "label"],
    rows: [
      ["medios", "tv", "Televisión"], ["medios", "radio", "Radio"],
      ["cargo", "jefe", "Jefe"], ["cargo", "practicante", "Practicante"],
    ],
  },
  settings: { columns: [], rows: [] },
};
const filtro = (w: XlsformEditorWorkbook, fila: number) => w.survey.rows[fila]![w.survey.columns.indexOf("choice_filter")];
const analisis = (w: XlsformEditorWorkbook, fila: number) => analizarFiltro({ structure: parseBuilderStructure(w.survey), choices: w.choices }, fila)!;

describe("lo marcado antes", () => {
  it("escribe selected(${q}, name) y se relee como «Lo marcado antes»", () => {
    const i = { forma: "marcado" as const, madre: "usa" };
    expect(intentoCompleto(i)).toBe(true);
    const w = escribirIntento(wb, 2, "medios", i);
    expect(filtro(w, 2)).toBe("selected(${usa}, name)");
    const a = analisis(w, 2);
    expect(nombreDeTipo(a)).toBe("Lo marcado antes");
    expect(formaDe(a)).toBe("marcado");
    expect(intentoInicial("marcado", a, "principal", w.choices)).toEqual({ forma: "marcado", madre: "usa" });
  });
});

describe("según un número", () => {
  it("crea la columna y escribe la comparación, que se relee igual", () => {
    const i = { forma: "comparacion" as const, columna: "edad_min", operador: "<=" as const, pregunta: "edad" };
    const w = escribirIntento(wb, 3, "cargo", i);
    expect(filtro(w, 3)).toBe("edad_min <= ${edad}");
    expect(w.choices.columns).toContain("edad_min");
    const a = analisis(w, 3);
    expect(formaDe(a)).toBe("comparacion");
    expect(intentoInicial("comparacion", a, "cargo", w.choices)).toEqual(i);
    expect(leerComparacion("edad_min <= 18")).toBeNull();
  });
  it("sin pregunta o con la columna name no está completa", () => {
    expect(intentoCompleto({ forma: "comparacion", columna: "edad_min", operador: "<=", pregunta: "" })).toBe(false);
    expect(intentoCompleto({ forma: "comparacion", columna: "name", operador: "<=", pregunta: "edad" })).toBe(false);
  });
});
