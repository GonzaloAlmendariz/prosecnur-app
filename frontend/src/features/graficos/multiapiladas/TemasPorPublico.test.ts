import { describe, expect, it } from "vitest";
import type { VarWithSource } from "../useVariables";
import { conRef, otraEscala, refDePublico, type TemaPublicos } from "./TemasPorPublico";

const pubs = ["docentes", "administrativos", "estudiantes"];
const v = (source: string, name: string, scale_signature: string) => ({ source, name, label: name, tipo: "select_one", seccion: "", scale_signature }) as VarWithSource;
const vars = [v("docentes", "p12_1", "sat5"), v("administrativos", "p10_1", "sat5"), v("estudiantes", "p11_1", "sat4")];

describe("una tarjeta por tema, una línea por público (G12 parte 2)", () => {
  const tema: TemaPublicos = { key: "tema_1", title: "Servicio de salud", vars: ["docentes$p12_1", "estudiantes$p11_1"] };
  it("cada pregunta va en la línea de su público y las refs quedan en el orden de los públicos", () => {
    expect(refDePublico(tema, "estudiantes")).toBe("estudiantes$p11_1");
    expect(refDePublico(tema, "administrativos")).toBe("");
    const t2 = conRef(tema, pubs, "administrativos", "administrativos$p10_1");
    expect(t2.vars).toEqual(["docentes$p12_1", "administrativos$p10_1", "estudiantes$p11_1"]);
    expect(conRef(t2, pubs, "docentes", null).vars).toEqual(["administrativos$p10_1", "estudiantes$p11_1"]);
  });
  it("una pregunta de otra escala que la primera del tema se marca", () => {
    expect(otraEscala(vars, tema, "estudiantes$p11_1")).toBe(true);
    expect(otraEscala(vars, tema, "docentes$p12_1")).toBe(false);
  });
});
