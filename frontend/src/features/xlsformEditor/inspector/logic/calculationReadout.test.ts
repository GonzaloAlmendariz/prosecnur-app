import { describe, expect, test } from "vitest";

import { parseExpression } from "../../logic";
import { readCalculation } from "./calculationReadout";

/** Forma real de `indice_hs` en HST_UNSA, recortada a tres preguntas: un
 *  `or` de bloques `and` que comprueban presencia y descartan 98/99. */
const INDICE_HS =
  "if((${p9} != '' and not(selected(${p9}, '98')) and not(selected(${p9}, '99'))) " +
  "or (${p10} != '' and not(selected(${p10}, '98')) and not(selected(${p10}, '99'))) " +
  "or (${p11} != '' and not(selected(${p11}, '98')) and not(selected(${p11}, '99'))), 1, 0)";

describe("readCalculation", () => {
  test("cuenta bloques y comparaciones de un índice por `or` de `and`", () => {
    const ast = parseExpression(INDICE_HS);
    expect(ast).not.toBeNull();

    const readout = readCalculation(ast!);
    expect(readout).toEqual({
      conector: "or",
      bloques: 3,
      comparaciones: 9,
      entonces: "1",
      siNo: "0",
    });
  });

  test("una condición simple declara un solo bloque y ningún conector", () => {
    const ast = parseExpression("if(${p9} = 'si', 1, 0)");
    const readout = readCalculation(ast!);

    expect(readout?.conector).toBeNull();
    expect(readout?.bloques).toBe(1);
    expect(readout?.comparaciones).toBe(1);
  });

  test("las ramas no literales se muestran serializadas", () => {
    const ast = parseExpression("if(${p9} = 'si', ${p10}, today())");
    const readout = readCalculation(ast!);

    expect(readout?.entonces).toBe("${p10}");
    expect(readout?.siNo).toBe("today()");
  });

  test("una fórmula que no es un `if` no produce lectura", () => {
    const ast = parseExpression("count-selected(${p9})");
    expect(readCalculation(ast!)).toBeNull();
  });
});
