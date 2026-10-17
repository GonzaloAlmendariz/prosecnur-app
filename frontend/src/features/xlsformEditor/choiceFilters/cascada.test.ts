// La cascada se escribe en la forma estándar de XLSForm y se puede leer de vuelta para editarla. Mata: escribir el
// filtro en otra fila, tocar opciones de otra lista, perder la columna en una hoja sin ella o no reconocer la forma.
import { describe, expect, it } from "vitest";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { aplicarCascada, asignacionesActuales, columnaSugerida, leerExpresionCascada, quitarCascada } from "./cascada";

const wb = (): XlsformEditorWorkbook => ({
  survey: { columns: ["type", "name", "label"], rows: [["select_one dep", "departamento", "Departamento"], ["select_one prov", "provincia", "Provincia"]] },
  choices: { columns: ["list_name", "name", "label"], rows: [["dep", "15", "Lima"], ["dep", "04", "Arequipa"], ["prov", "1501", "Lima"], ["prov", "0401", "Arequipa"], ["otra", "1501", "X"]] },
  settings: { columns: [], rows: [] },
});

describe("filtro de opciones en cascada", () => {
  it("escribe la columna de vínculo en la lista hija y el choice_filter en su fila", () => {
    const col = columnaSugerida(wb().choices, "departamento");
    expect(col).toBe("filtro_departamento");
    const out = aplicarCascada(wb(), 1, "prov", { madre: "departamento", columna: col, asignaciones: { "1501": "15", "0401": "04" } });
    expect(out.survey.columns).toContain("choice_filter");
    expect(out.survey.rows[1][out.survey.columns.indexOf("choice_filter")]).toBe("filtro_departamento=${departamento}");
    expect(out.survey.rows[0][out.survey.columns.indexOf("choice_filter")]).toBe("");
    const iC = out.choices.columns.indexOf(col);
    expect(out.choices.rows.map((r) => r[iC])).toEqual(["", "", "15", "04", ""]);
    expect(asignacionesActuales(out.choices, "prov", col)).toEqual({ "1501": "15", "0401": "04" });
  });
  it("lee la forma simple y rechaza otras; quitar deja la columna", () => {
    expect(leerExpresionCascada("filtro_departamento=${departamento}")).toEqual({ columna: "filtro_departamento", madre: "departamento" });
    expect(leerExpresionCascada("selected(${a}, name)")).toBeNull();
    const con = aplicarCascada(wb(), 1, "prov", { madre: "departamento", columna: "filtro_departamento", asignaciones: {} });
    const sin = quitarCascada(con, 1);
    expect(sin.survey.rows[1][sin.survey.columns.indexOf("choice_filter")]).toBe("");
    expect(sin.choices.columns).toContain("filtro_departamento");
  });
});
