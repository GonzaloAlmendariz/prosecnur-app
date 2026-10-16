import { describe, expect, test } from "vitest";
import type { LogicScope } from "../logic";
import { describeExpression } from "./reglasHumanas";

const scope: LogicScope = { variables: [{ rowIndex: 1, name: "edad", label: "Edad", baseType: "integer" }], catalogsByListName: new Map(), allowCurrent: false };

describe("lectura humana de reglas", () => {
  test("un rango sobre la propia respuesta se lee como rango, no como dos frases", () => {
    expect(describeExpression(". >= 18 and . <= 100", scope, { currentLabel: "La respuesta" }).summary).toBe("La respuesta está entre 18 y 100");
  });
  test("un rango abierto dice «mayor que» / «menor que»", () => {
    expect(describeExpression(". > 0 and . < 24", scope, { currentLabel: "La respuesta" }).summary).toBe("La respuesta es mayor que 0 y menor que 24");
  });
  test("las cláusulas que siguen a la primera no repiten la mayúscula", () => {
    const lee = describeExpression(". >= 1 and . != 5", scope, { currentLabel: "La respuesta" }).summary;
    expect(lee).not.toMatch(/ y La /);
    expect(lee).toMatch(/^La respuesta/);
  });
});
