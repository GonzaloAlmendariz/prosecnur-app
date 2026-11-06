import { describe, expect, it } from "vitest";

import { enumerar } from "./enumerar";

describe("enumerar: datos en una frase, no pegados con «·»", () => {
  it("une con comas y la conjunción antes del último", () => {
    expect(enumerar(["10 facultades", "977 alumnos elegibles", "11 reservas por aula"])).toBe(
      "10 facultades, 977 alumnos elegibles y 11 reservas por aula",
    );
    expect(enumerar(["Kobo", "SurveyMonkey"], "o")).toBe("Kobo o SurveyMonkey");
  });

  it("ignora las partes vacías: no deja comas colgando", () => {
    expect(enumerar(["a", null, "", undefined, false, "b"])).toBe("a y b");
    expect(enumerar([null, "sola"])).toBe("sola");
    expect(enumerar([])).toBe("");
  });

  it("acepta cifras", () => {
    expect(enumerar([1, 2, 3])).toBe("1, 2 y 3");
  });

  it("concuerda la conjunción como en español", () => {
    expect(enumerar(["Lima", "Ica"])).toBe("Lima e Ica");
    expect(enumerar(["agua", "hielo"])).toBe("agua y hielo");
    expect(enumerar(["padres", "hijos"])).toBe("padres e hijos");
    expect(enumerar(["siete", "ocho"], "o")).toBe("siete u ocho");
    expect(enumerar(["uno", "otro"], "o")).toBe("uno u otro");
    expect(enumerar(["Arequipa", "Cusco"], "o")).toBe("Arequipa o Cusco");
  });
});
