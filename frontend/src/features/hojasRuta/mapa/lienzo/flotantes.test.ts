import { describe, expect, it } from "vitest";
import { nombreDelTerritorio } from "./flotantes";

describe("nombre del territorio en la miga (checklist F6)", () => {
  it('nombra las ciudades del estudio, no un "Lima" fijo', () => {
    expect(nombreDelTerritorio(["Arequipa"])).toBe("Arequipa");
    expect(nombreDelTerritorio(["Lima y Callao", "Arequipa"])).toBe("Lima y Callao, Arequipa");
  });
  it("con muchas, las cuenta; sin ninguna, lo dice", () => {
    expect(nombreDelTerritorio(["A", "B", "C"])).toBe("3 ciudades");
    expect(nombreDelTerritorio([])).toBe("Sin ciudades");
  });
});
