import { describe, expect, it } from "vitest";
import { errorNombreBase } from "./NuevaBaseArchivos";

describe("nombre de una base nueva", () => {
  it("sin espacios ni $, y sin repetir otra", () => {
    expect(errorNombreBase("", ["docentes"])).toBeNull();
    expect(errorNombreBase("egresados", ["docentes"])).toBeNull();
    expect(errorNombreBase("personal admin", [])).toMatch(/espacios/);
    expect(errorNombreBase("a$b", [])).toMatch(/espacios/);
    expect(errorNombreBase("docentes", ["docentes"])).toMatch(/Ya hay/);
  });
});
