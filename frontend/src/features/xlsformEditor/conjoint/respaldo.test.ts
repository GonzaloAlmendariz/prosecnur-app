// Experimento de respaldo (C15, 2026-11-07). Mata: una frase de control con {actor} o una de respaldo sin él dadas
// por buenas, un grupo de control que ve a un actor, una frase que no cita la política, un lector que no lo reconoce o
// pierde actores, políticas o frases, y un reemplazo que duplica la escala o cambia los nombres.
import { describe, expect, it } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { insertRecord, makeSheet, rowToRecord } from "../parsing/sheetUtils";
import type { XlsformEditorWorkbook } from "../types";
import { calcularValores } from "../shell/simulador/calculosPrueba";
import { buildXlsformIndex } from "../parsing/buildIndex";
import { insertarRespaldo, reemplazarRespaldo } from "./insertarConjoint";
import { leerConjoint } from "./leerConjoint";
import { leerLista } from "./leerLista";
import { leerRespaldo } from "./leerRespaldo";
import { leerVersiones } from "./leerVersiones";
import { leerVinetas } from "./leerVinetas";
import { fraseDe, generarRespaldo, respaldoInicial, validarRespaldo, type DisenoRespaldo } from "./modeloRespaldo";

const diseno = (): DisenoRespaldo => ({ ...respaldoInicial("rs"), actores: ["las Fuerzas Armadas", "el Congreso"], fraseRespaldo: "Esta propuesta, que {politica}, cuenta con el apoyo de {actor}." });

function formulario(): XlsformEditorWorkbook {
  const wb: XlsformEditorWorkbook = {
    survey: makeSheet("survey", ["type", "name", "label", "calculation", "relevant", "appearance", "required"]),
    choices: makeSheet("choices", ["list_name", "name", "label"]),
    settings: makeSheet("settings", []),
  };
  insertRecord(wb.survey, 0, { type: "integer", name: "edad", label: "Edad" });
  return wb;
}

describe("experimento de respaldo", () => {
  it("valida las frases", () => {
    expect(validarRespaldo(diseno())).toEqual([]);
    expect(validarRespaldo({ ...diseno(), fraseControl: "{actor} propone que {politica}." }).join(" ")).toContain("no lleva {actor}");
    expect(validarRespaldo({ ...diseno(), fraseRespaldo: "Se propone que {politica}." }).join(" ")).toContain("{actor} y {politica}");
  });

  it("el grupo de control lee la política sin actor y los demás, con el suyo", () => {
    const { survey } = generarRespaldo(diseno());
    const texto = survey.find((f) => f.name === "rs_p1_texto")!.calculation;
    expect(texto).toBe("if(${rs_brazo} = '1', concat('Una propuesta plantea que ', ${rs_p1}, '.'), concat('Esta propuesta, que ', ${rs_p1}, ', cuenta con el apoyo de ', ${rs_actor}, '.'))");
    expect(fraseDe(diseno(), 0, "x")).toBe("Una propuesta plantea que x.");
    expect(fraseDe(diseno(), 2, "x")).toBe("Esta propuesta, que x, cuenta con el apoyo de el Congreso.");
    // Un sorteo concreto: el valor de la frase sale de concat() con el actor que tocó.
    const wb = formulario();
    insertarRespaldo(wb, parseBuilderStructure(wb.survey), { despuesDeFila: 0, seccionFila: null }, diseno());
    const v = calcularValores(buildXlsformIndex(wb).structure.outline, {}, 7);
    const esperado = v.rs_brazo === "1" ? "Una propuesta plantea que se amplíe el servicio militar voluntario." : `Esta propuesta, que se amplíe el servicio militar voluntario, cuenta con el apoyo de ${v.rs_actor}.`;
    expect(v.rs_p1_texto).toBe(esperado);
  });

  it("se inserta, se reconoce entero y se reemplaza sin duplicar la escala", () => {
    const wb = formulario();
    expect(insertarRespaldo(wb, parseBuilderStructure(wb.survey), { despuesDeFila: 0, seccionFila: null }, diseno()).ok).toBe(true);
    const [l] = leerRespaldo(wb);
    expect(l!.fiel).toBe(true);
    expect(l!.diseno).toEqual(diseno());
    expect(leerConjoint(wb)).toBeNull();
    expect(leerVinetas(wb)).toBeNull();
    expect(leerVersiones(wb)).toEqual([]);
    expect(leerLista(wb)).toEqual([]);
    const r = reemplazarRespaldo(wb, l!, { ...diseno(), politicas: [...diseno().politicas, "se reduzca el gasto militar"] });
    expect(r.ok).toBe(true);
    expect(rowToRecord(wb.survey, 0).name).toBe("edad");
    expect(leerRespaldo(wb)[0]!.diseno.politicas).toHaveLength(3);
    expect(wb.choices.rows.filter((_, i) => rowToRecord(wb.choices, i).list_name === "rs_apoyo")).toHaveLength(5);
  });
});
