import { describe, expect, test } from "vitest";
import type { LogicScope } from "../logic";
import type { BuilderNode } from "../types";
import { describeExpression, describeValidation } from "./reglasHumanas";

const nodo = { typeInfo: { raw: "text", base: "text", listName: "" } } as BuilderNode;
const scope: LogicScope = { variables: [{ rowIndex: 1, name: "edad", label: "Edad", baseType: "integer" }], catalogsByListName: new Map(), allowCurrent: false };

describe("lectura humana de reglas", () => {
  test("un rango sobre la propia respuesta se lee como rango (voz de lo que acepta), no como dos frases", () => {
    expect(describeExpression(". >= 18 and . <= 100", scope, { currentLabel: "La respuesta" }).summary).toBe("De 18 a 100");
  });
  test("un rango abierto dice «mayor que» / «menor que»", () => {
    expect(describeExpression(". > 0 and . < 24", scope, { currentLabel: "La respuesta" }).summary).toBe("Mayor que 0 y menor que 24");
  });
  test("las cláusulas que siguen a la primera no repiten la mayúscula", () => {
    const lee = describeExpression("${edad} >= 1 and ${edad} != 5", scope).summary;
    expect(lee).not.toMatch(/ y [A-Z]/);
    expect(lee).toBe("Edad es 1 o más y no es 5");
  });
  test("describeValidation deriva su texto del motor en piezas", () => {
    const fecha = { name: "f", typeInfo: { raw: "date", base: "date", listName: "" } } as BuilderNode;
    expect(describeValidation("today() >= .", fecha, scope)?.summary).toBe("No acepta fechas futuras");
    expect(describeValidation(". <= today()", fecha, scope)?.status).toBe("Preset claro");
    expect(describeValidation("string-length(.) <= 9", nodo, scope)?.summary).toBe("Máximo 9 caracteres");
  });
});

describe("lectura humana de funciones del corpus real", () => {
  const leer = (e: string) => describeExpression(e, scope, { currentLabel: "La respuesta" }).summary;
  test("un regex de formato muestra un ejemplo, no «solo números»", () => {
    expect(describeValidation("regex(., '^[0-9]{2}[/][0-9]{4}$')", nodo, scope)?.summary).toBe("Solo acepta el formato 99/9999");
    expect(describeValidation("regex(., '^[0-9]{9}$')", nodo, scope)?.summary).toBe("Solo acepta 9 dígitos");
  });
  test("una opción exclusiva se lee como regla, no como «No se cumple»", () => {
    expect(leer("not(selected(., 'none') and count-selected(.) > 1)")).toBe("none no se puede marcar junto con otras opciones");
  });
  test("if con valores dice qué vale en cada caso", () => {
    expect(leer("if(${edad} < 25, 'joven', 'adulto')")).toBe("Si Edad es menor que 25, vale «joven». Si no, vale «adulto»");
  });
  test("una suma de preguntas se lee como suma", () => {
    expect(leer("${edad} + ${edad}")).toBe("La suma de Edad y Edad");
  });
  test("funciones de repetición y tiempo", () => {
    expect(leer("position(..)")).toBe("El número de esta fila");
    expect(leer("once(today())")).toBe("Hoy (se guarda la primera vez y no cambia)");
    expect(leer("int((decimal-date-time(${edad}) - decimal-date-time(${edad})) * 24 * 60)")).toMatch(/^Los minutos entre/);
  });
  test("comillas tipográficas: se lee el sentido y se señala el error", () => {
    // S7: el aviso va aparte de la frase, no metido en ella.
    const l = describeExpression("${edad} = “OK”", scope);
    expect(l.summary).toBe("Edad es OK");
    expect(l.aviso).toMatch(/comillas tipográficas/);
  });
  test("mayúscula sólo al inicio y contracciones", () => {
    expect(leer("if(. = '1', ${edad} > 3, true())")).toBe("Si la respuesta es 1, Edad tiene que ser mayor que 3");
    expect(leer("int(format-date(${edad}, '%Y')) <= 2025")).toBe("El año de Edad es 2025 o menos");
  });
});
