// Orden al azar de las opciones (C16, 2026-11-07). Mata: perder los demás parámetros de una pregunta al ordenarla,
// dejar el orden puesto en una pregunta que se sacó del experimento, duplicar la semilla al volver a aplicar, no
// reconocer el orden ya escrito, y no avisar que «No sabe» u «Otro» también se barajan.
import { describe, expect, it } from "vitest";
import { insertRecord, makeSheet, rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { aplicarOrden, conOrden, esEscala, leerOrden, opcionesQueSeMueven, sinOrden, validarOrden } from "./modeloOrden";

function formulario(): XlsformEditorWorkbook {
  const wb: XlsformEditorWorkbook = {
    survey: makeSheet("survey", ["type", "name", "label", "calculation", "parameters"]),
    choices: makeSheet("choices", ["list_name", "name", "label"]),
    settings: makeSheet("settings", []),
  };
  insertRecord(wb.survey, 0, { type: "select_one partido", name: "P1", label: "¿Por quién votaría?", parameters: "" });
  insertRecord(wb.survey, 1, { type: "select_multiple medios", name: "P2", label: "¿Dónde se informa?", parameters: "columns=2" });
  insertRecord(wb.survey, 2, { type: "integer", name: "edad", label: "Edad" });
  return wb;
}
const parametros = (wb: XlsformEditorWorkbook, n: string) => rowToRecord(wb.survey, wb.survey.rows.findIndex((_, i) => rowToRecord(wb.survey, i).name === n)).parameters;

describe("orden al azar de las opciones", () => {
  it("pone y quita el orden sin tocar los demás parámetros", () => {
    expect(conOrden("columns=2", "or_semilla")).toBe("columns=2 randomize=true seed=${or_semilla}");
    expect(sinOrden("columns=2 randomize=true seed=${or_semilla}")).toBe("columns=2");
    expect(conOrden("randomize=true seed=${viejo}", "or_semilla")).toBe("randomize=true seed=${or_semilla}");
  });

  it("valida que sean preguntas de selección", () => {
    expect(validarOrden({ prefijo: "or", preguntas: ["P1"] }, ["P1", "P2"])).toEqual([]);
    expect(validarOrden({ prefijo: "or", preguntas: ["edad"] }, ["P1", "P2"]).join(" ")).toContain("no es una pregunta de selección");
  });

  it("se aplica con una sola semilla, se reconoce y al editarlo se saca el orden de la que ya no va", () => {
    const wb = formulario();
    aplicarOrden(wb, { prefijo: "or", preguntas: ["P1", "P2"] }, 0, null);
    expect(rowToRecord(wb.survey, 0)).toMatchObject({ type: "calculate", name: "or_semilla" });
    expect(parametros(wb, "P2")).toBe("columns=2 randomize=true seed=${or_semilla}");
    const [l] = leerOrden(wb);
    expect(l!.diseno).toEqual({ prefijo: "or", preguntas: ["P1", "P2"] });
    aplicarOrden(wb, { prefijo: "or", preguntas: ["P1"] }, 0, l!);
    expect(parametros(wb, "P2")).toBe("columns=2");
    expect(wb.survey.rows.filter((_, i) => rowToRecord(wb.survey, i).name === "or_semilla")).toHaveLength(1);
    expect(leerOrden(wb)[0]!.diseno.preguntas).toEqual(["P1"]);
  });

  it("avisa las opciones que suelen ir al final", () => {
    expect(esEscala([{ codigo: "1" }, { codigo: "2" }, { codigo: "3" }, { codigo: "4" }, { codigo: "5" }])).toBe(true);
    expect(esEscala([{ codigo: "pe" }, { codigo: "cl" }, { codigo: "ar" }])).toBe(false);
    expect(opcionesQueSeMueven([{ codigo: "1", etiqueta: "Perú Libre" }, { codigo: "88", etiqueta: "No sabe" }, { codigo: "96", etiqueta: "Otro" }])).toEqual(["No sabe", "Otro"]);
  });
});
