// El alcance de lectura no depende de la selección: incluye toda pregunta con nombre y deja fuera secciones.
import { describe, expect, test } from "vitest";
import { parseBuilderStructure } from "../parsing/buildIndex";
import type { XlsformEditorSheet } from "../types";
import { alcanceDeLectura } from "./alcanceLectura";

const survey: XlsformEditorSheet = {
  name: "survey",
  columns: ["type", "name", "label"],
  rows: [
    ["integer", "edad", "Edad"],
    ["begin_group", "hogar", "Hogar"],
    ["select_one sino", "jefe", "¿Es jefe?"],
    ["end_group", "", ""],
    ["note", "", "Gracias"],
  ],
};

describe("alcanceDeLectura", () => {
  test("todas las variables con nombre, sin secciones, con sus catálogos", () => {
    const s = parseBuilderStructure(survey);
    const a = alcanceDeLectura(s, [{ listName: "sino", items: [] }]);
    expect(a.variables.map((v) => v.name)).toEqual(["edad", "jefe"]);
    expect(a.variables[1]?.listName).toBe("sino");
    expect(a.catalogsByListName.has("sino")).toBe(true);
  });

  test("sin estructura queda vacío", () => {
    expect(alcanceDeLectura(null, []).variables).toEqual([]);
  });
});
