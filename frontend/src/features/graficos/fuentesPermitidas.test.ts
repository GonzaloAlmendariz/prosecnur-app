import { describe, expect, it } from "vitest";
import { fuentesPermitidas } from "./fuentesPermitidas";

const todas = [{ name: "docentes" }, { name: "estudiantes" }, { name: "egresados" }];

describe("fuentesPermitidas", () => {
  it("sólo las bases elegidas en la lámina, en el orden del estudio", () => {
    expect(fuentesPermitidas(todas, null, ["egresados", "docentes"]).map((s) => s.name)).toEqual(["docentes", "egresados"]);
  });
  it("sin bases elegidas, o con ninguna conocida, todas", () => {
    expect(fuentesPermitidas(todas, null, null)).toHaveLength(3);
    expect(fuentesPermitidas(todas, null, [])).toHaveLength(3);
    expect(fuentesPermitidas(todas, null, ["otra"])).toHaveLength(3);
  });
  it("`soloBase` manda sobre la lista", () => {
    expect(fuentesPermitidas(todas, "estudiantes", ["docentes"]).map((s) => s.name)).toEqual(["estudiantes"]);
  });
});
