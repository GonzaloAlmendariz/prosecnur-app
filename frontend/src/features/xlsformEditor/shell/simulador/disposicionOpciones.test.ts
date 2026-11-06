// Mata: una escala likert que sale como lista vertical y un `columns` ignorado en Probar.
import { describe, expect, it } from "vitest";
import type { BuilderNode } from "../../types";
import { disposicionOpciones } from "./disposicionOpciones";

const nodo = (raw: string, appearance: string) =>
  ({ appearance, typeInfo: { raw, base: raw.split(" ")[0], listName: raw.split(" ")[1] ?? "" } }) as Pick<BuilderNode, "typeInfo" | "appearance">;

describe("disposición de opciones en Probar", () => {
  it("likert en select_one es escala en fila", () => {
    expect(disposicionOpciones(nodo("select_one escala", "likert"))).toBe("escala");
    expect(disposicionOpciones(nodo("select_one escala", "LIKERT w3"))).toBe("escala");
  });
  it("columns es columnas; sin appearance, lista", () => {
    expect(disposicionOpciones(nodo("select_multiple frutas", "columns"))).toBe("columnas");
    expect(disposicionOpciones(nodo("select_one sino", ""))).toBe("lista");
  });
});
