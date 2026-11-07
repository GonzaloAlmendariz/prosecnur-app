// Experimento de lista (C14, 2026-11-07). Mata: una afirmación sensible repetida o fuera de lugar dada por buena, un
// conteo que deja contestar más afirmaciones de las que vio el encuestado, una lista que se muestra al grupo que no
// es, un lector que no lo reconoce o pierde la posición o la probabilidad, y un reemplazo que cambia los nombres.
import { describe, expect, it } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { insertRecord, makeSheet, rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { insertarLista, reemplazarLista } from "./insertarConjoint";
import { leerConjoint } from "./leerConjoint";
import { leerLista } from "./leerLista";
import { leerVersiones } from "./leerVersiones";
import { leerVinetas } from "./leerVinetas";
import { generarLista, listaInicial, listaTratamiento, validarLista, type DisenoLista } from "./modeloLista";

const diseno = (): DisenoLista => ({ ...listaInicial("ls"), posicion: 2, probTratamiento: 0.6 });

function formulario(): XlsformEditorWorkbook {
  const wb: XlsformEditorWorkbook = {
    survey: makeSheet("survey", ["type", "name", "label", "calculation", "relevant", "constraint", "constraint_message", "appearance", "required"]),
    choices: makeSheet("choices", ["list_name", "name", "label"]),
    settings: makeSheet("settings", []),
  };
  insertRecord(wb.survey, 0, { type: "integer", name: "edad", label: "Edad" });
  return wb;
}
const nombres = (wb: XlsformEditorWorkbook) => wb.survey.rows.map((_, i) => rowToRecord(wb.survey, i).name);

describe("experimento de lista", () => {
  it("valida la sensible y su lugar", () => {
    expect(validarLista(diseno())).toEqual([]);
    expect(validarLista({ ...diseno(), sensible: diseno().controles[0]! }).join(" ")).toContain("dicen lo mismo");
    expect(validarLista({ ...diseno(), posicion: 9 }).join(" ")).toContain("fuera de la lista");
  });

  it("cada grupo ve su lista y el conteo llega al número de afirmaciones que vio", () => {
    const filas = generarLista(diseno());
    const por = (n: string) => filas.find((f) => f.name === n)!;
    expect(listaTratamiento(diseno())[1]).toBe(diseno().sensible);
    expect(por("ls_control").relevant).toBe("${ls_asignacion} = '1'");
    expect(por("ls_tratamiento").relevant).toBe("${ls_asignacion} = '2'");
    expect(por("ls_tratamiento").label.split("\n")).toHaveLength(4);
    expect(por("ls_conteo").constraint).toBe(". >= 0 and . <= if(${ls_asignacion} = '2', 4, 3)");
    expect(por("ls_asignacion").calculation).toBe("if(${ls_r} < 0.4, '1', '2')");
  });

  it("se inserta, se reconoce con su posición y probabilidad, y se reemplaza con los mismos nombres", () => {
    const wb = formulario();
    expect(insertarLista(wb, parseBuilderStructure(wb.survey), { despuesDeFila: 0, seccionFila: null }, diseno()).ok).toBe(true);
    const [l] = leerLista(wb);
    expect(l!.fiel).toBe(true);
    expect(l!.diseno).toEqual(diseno());
    expect(leerConjoint(wb)).toBeNull();
    expect(leerVinetas(wb)).toBeNull();
    expect(leerVersiones(wb)).toEqual([]);
    const r = reemplazarLista(wb, l!, { ...diseno(), controles: [...diseno().controles, "He votado en la última elección."] });
    expect(r.ok).toBe(true);
    expect(nombres(wb)).toEqual(["edad", "ls_r", "ls_asignacion", "ls_pagina", "ls_control", "ls_tratamiento", "ls_conteo", ""]);
    expect(leerLista(wb)[0]!.diseno.controles).toHaveLength(4);
  });
});
