// Mata: un cálculo que depende de un sorteo a dos saltos y no se detecta, un cálculo de respuestas tratado como
// sorteo, un ejemplo que cambia entre aperturas y una nota fija rotulada como ejemplo.
import { describe, expect, it } from "vitest";
import type { BuilderNode } from "../types";
import { ROTULO_EJEMPLO, calculosSorteados, citaSorteo, conEjemploParaPapel, valoresDeEjemplo } from "./ejemploSorteo";
import type { XlsformEditorWorkbook } from "../types";

let fila = 0;
const calc = (name: string, calculation: string) =>
  ({ name, kind: "calculate", rowIndex: ++fila, calculation, label: "", relevant: "", typeInfo: { raw: "calculate", base: "calculate", listName: "" } }) as unknown as BuilderNode;

const outline = [
  calc("r", "once(random())"),
  calc("nivel", "if(${r} < 0.5, 'a', 'b')"),
  calc("txt", "if(${nivel} = 'a', 'Alfa', 'Beta')"),
  calc("doble", "${edad} * 2"),
];

describe("sorteos en el documento", () => {
  it("detecta lo que depende de un random() aunque sea a dos saltos", () => {
    expect([...calculosSorteados(outline)].sort()).toEqual(["nivel", "r", "txt"]);
  });
  it("el ejemplo es estable y sólo fija los sorteados", () => {
    const a = valoresDeEjemplo(outline);
    expect(valoresDeEjemplo(outline).valores).toEqual(a.valores);
    expect(["Alfa", "Beta"]).toContain(a.valores.txt);
    expect(a.valores).not.toHaveProperty("doble");
  });
  it("sólo una nota que cita un sorteo es de ejemplo", () => {
    const { sorteados } = valoresDeEjemplo(outline);
    expect(citaSorteo("| x | ${txt} |", sorteados)).toBe(true);
    expect(citaSorteo("Usted tiene ${edad} años", sorteados)).toBe(false);
  });
});

describe("el papel recibe el par con su ejemplo (E8c)", () => {
  const wb = {
    survey: {
      name: "survey",
      columns: ["type", "name", "label", "calculation"],
      rows: [
        ["calculate", "r", "", "once(random())"],
        ["calculate", "nivel", "", "if(${r} < 0.5, 'Alfa', 'Beta')"],
        ["note", "par", "| | A |\n|---|---|\n| Nivel | ${nivel} |", ""],
        ["note", "fija", "Hola ${edad}", ""],
        ["integer", "edad", "Edad", ""],
      ],
    },
    choices: { name: "choices", columns: [], rows: [] },
    settings: { name: "settings", columns: [], rows: [] },
  } as unknown as XlsformEditorWorkbook;

  it("la nota con sorteo sale con el valor de ejemplo y el rótulo; lo demás no se toca", () => {
    const out = conEjemploParaPapel(wb);
    const par = out.survey.rows[2]![2]!;
    expect(par).toMatch(/\| Nivel \| (Alfa|Beta) \|/);
    expect(par).toContain(ROTULO_EJEMPLO);
    expect(par).not.toContain("${");
    expect(out.survey.rows[3]![2]).toBe("Hola ${edad}");
    expect(wb.survey.rows[2]![2]).toContain("${nivel}");
  });
});
