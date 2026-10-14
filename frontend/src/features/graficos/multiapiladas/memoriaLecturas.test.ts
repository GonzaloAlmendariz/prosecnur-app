import { describe, expect, it } from "vitest";
import { guardarLectura, recuperarLectura } from "./memoriaLecturas";

describe("cambiar de lectura no destruye lo avanzado (G12 parte 2)", () => {
  it("ir de «Públicos por tema» a «Preguntas» y volver recupera los temas con sus nombres", () => {
    const m = new Map();
    const temas = { modo: "var_cruce", vars: { tema_1: ["docentes$p12_1", "estudiantes$p11_1"] }, titulos_grupo: { tema_1: "Servicio de salud" } };
    guardarLectura("s1:grafico", "publicos_tema", temas, m);
    guardarLectura("s1:grafico", "comparar", { modo: "var", vars: ["docentes$p12_1"] }, m);
    expect(recuperarLectura("s1:grafico", "publicos_tema", m)).toMatchObject({ vars: temas.vars, titulos_grupo: temas.titulos_grupo, modo: "var_cruce" });
    expect(recuperarLectura("s1:grafico", "comparar", m)?.vars).toEqual(["docentes$p12_1"]);
    expect(recuperarLectura("otra:grafico", "publicos_tema", m)).toBeNull();
  });
  it("la foto no cambia si después se edita el objeto original; una lectura vacía no pisa una con contenido", () => {
    const m = new Map();
    const args = { modo: "var", vars: ["a", "b"] };
    guardarLectura("s", "comparar", args, m);
    args.vars.push("c");
    expect(recuperarLectura("s", "comparar", m)?.vars).toEqual(["a", "b"]);
    guardarLectura("s", "comparar", { modo: "var", vars: [] }, m);
    expect(recuperarLectura("s", "comparar", m)?.vars).toEqual(["a", "b"]);
  });
});

describe("una lectura vacía no se restaura (pérdida de temas, 2026-10-14)", () => {
  it("la foto vacía de «Preguntas» no vuelve: volver a ella arrastra lo armado en vez de borrarlo", () => {
    const m = new Map();
    // Lámina nueva (args vacíos, se lee como «Preguntas») que pasa a «Públicos por tema».
    guardarLectura("s:g", "comparar", {}, m);
    expect(recuperarLectura("s:g", "comparar", m)).toBeNull();
  });

  it("una foto con contenido sí vuelve", () => {
    const m = new Map();
    guardarLectura("s:g", "comparar", { modo: "var", vars: ["estudiantes$p1"] }, m);
    expect(recuperarLectura("s:g", "comparar", m)).toMatchObject({ modo: "var", vars: ["estudiantes$p1"] });
  });
});
