// Mata: un cálculo que depende de un sorteo a dos saltos y no se detecta, un cálculo de respuestas tratado como
// sorteo, un ejemplo que cambia entre aperturas y una nota fija rotulada como ejemplo.
import { describe, expect, it } from "vitest";
import type { BuilderNode } from "../types";
import { calculosSorteados, citaSorteo, valoresDeEjemplo } from "./ejemploSorteo";

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
