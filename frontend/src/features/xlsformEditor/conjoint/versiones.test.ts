// Versiones al azar (C12, 2026-11-07). Mata: versiones repetidas o sin texto dadas por buenas, una lista inexistente,
// una pregunta cuyo enunciado no viene de la versión sorteada, un lector que no la reconoce o pierde los pesos, y un
// reemplazo que toca la hoja choices (la lista es del formulario, no del experimento).
import { describe, expect, it } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { insertRecord, makeSheet, rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { insertarVersiones, reemplazarVersiones } from "./insertarConjoint";
import { leerVersiones } from "./leerVersiones";
import { generarVersiones, validarVersiones, type DisenoVersiones } from "./modeloVersiones";

const diseno = (): DisenoVersiones => ({
  prefijo: "vs",
  pregunta: "P5",
  tipo: "select_one",
  lista: "acuerdo",
  obligatoria: true,
  versiones: [{ texto: "¿Apoya la medida?", peso: 0.5 }, { texto: "¿Apoya la medida, aunque suban los impuestos?", peso: 0.5 }],
});

function formulario(): XlsformEditorWorkbook {
  const wb: XlsformEditorWorkbook = {
    survey: makeSheet("survey", ["type", "name", "label", "calculation", "appearance", "required"]),
    choices: makeSheet("choices", ["list_name", "name", "label"]),
    settings: makeSheet("settings", []),
  };
  insertRecord(wb.survey, 0, { type: "integer", name: "edad", label: "Edad" });
  insertRecord(wb.choices, 0, { list_name: "acuerdo", name: "1", label: "De acuerdo" });
  insertRecord(wb.choices, 1, { list_name: "acuerdo", name: "2", label: "En desacuerdo" });
  return wb;
}
const nombres = (wb: XlsformEditorWorkbook) => wb.survey.rows.map((_, i) => rowToRecord(wb.survey, i).name);

describe("versiones al azar", () => {
  it("valida textos, lista y pesos", () => {
    expect(validarVersiones(diseno(), ["acuerdo"])).toEqual([]);
    expect(validarVersiones({ ...diseno(), versiones: [{ texto: "Igual" }, { texto: "Igual" }] }).join(" ")).toContain("dicen lo mismo");
    expect(validarVersiones(diseno(), ["otra"]).join(" ")).toContain("no existe");
  });

  it("una sola variable de respuesta, con el enunciado de la versión sorteada", () => {
    const filas = generarVersiones(diseno());
    expect(filas.map((f) => f.name)).toEqual(["vs_r", "vs_version", "vs_texto", "P5"]);
    expect(filas[3]).toMatchObject({ type: "select_one acuerdo", label: "${vs_texto}", required: "yes" });
    expect(filas[1]!.calculation).toBe("if(${vs_r} < 0.5, '1', '2')");
  });

  it("se inserta, se reconoce con sus pesos y se reemplaza sin tocar choices", () => {
    const wb = formulario();
    const r = insertarVersiones(wb, parseBuilderStructure(wb.survey), { despuesDeFila: 0, seccionFila: null }, diseno());
    expect(r.ok).toBe(true);
    const [l] = leerVersiones(wb);
    expect(l!.fiel).toBe(true);
    expect(l!.diseno).toEqual(diseno());
    const choicesAntes = JSON.stringify(wb.choices.rows);
    const r2 = reemplazarVersiones(wb, l!, { ...diseno(), versiones: [...diseno().versiones.map((v) => ({ texto: v.texto })), { texto: "¿La apoyaría?" }] });
    expect(r2.ok).toBe(true);
    expect(nombres(wb)).toEqual(["edad", "vs_r", "vs_version", "vs_texto", "P5"]);
    expect(JSON.stringify(wb.choices.rows)).toBe(choicesAntes);
    expect(leerVersiones(wb)[0]!.diseno.versiones).toHaveLength(3);
  });

  it("una pregunta con un `${}` que no sale de un sorteo no es un experimento", () => {
    const wb = formulario();
    insertRecord(wb.survey, 1, { type: "calculate", name: "nombre_txt", calculation: "concat('a', 'b')" });
    insertRecord(wb.survey, 2, { type: "text", name: "q", label: "${nombre_txt}" });
    expect(leerVersiones(wb)).toEqual([]);
  });
});
