import { describe, expect, test } from "vitest";
import { safeText, safeTrimmedText, textOrNull } from "./safeText";

describe("safeText", () => {
  test("no devuelve objetos crudos para React", () => {
    expect(safeText({})).toBe("");
    expect(safeText({}, "Etiqueta")).toBe("Etiqueta");
  });

  test("extrae texto desde objetos comunes de metadata", () => {
    expect(safeText({ label: "Satisfaccion" })).toBe("Satisfaccion");
    expect(safeText({ titulo: "Objetivo" })).toBe("Objetivo");
    expect(safeText([{ name: "p1" }, { label: "P2" }])).toBe("p1, P2");
  });

  test("normaliza texto vacio", () => {
    expect(safeTrimmedText("   ", "Base")).toBe("Base");
    expect(textOrNull({})).toBeNull();
  });
});
