import { describe, expect, it } from "vitest";
import { canonicalClassroomOperationalCode } from "../classroomOperationalCode";

describe("canonicalClassroomOperationalCode", () => {
  it.each([
    ["AULA 5", "CH 5"],
    ["aula005", "CH 5"],
    ["CH5", "CH 5"],
    ["CH 5", "CH 5"],
    ["R5.1", "R 5.1"],
    ["r 005 . 02", "R 5.2"],
    ["R 5.1", "R 5.1"],
  ])("acepta el formato histórico %s y emite %s", (raw, expected) => {
    expect(canonicalClassroomOperationalCode(raw)).toBe(expected);
  });

  it("es idempotente para titulares y reemplazos canónicos", () => {
    for (const code of ["CH 17", "R 17.1", "R 17.11"]) {
      expect(canonicalClassroomOperationalCode(canonicalClassroomOperationalCode(code))).toBe(code);
    }
  });

  it("falla cerrado ante códigos desconocidos y usa el fallback solo si falta valor", () => {
    expect(canonicalClassroomOperationalCode("R 12")).toBe("R 12");
    expect(canonicalClassroomOperationalCode("grupo AULA 5")).toBe("grupo AULA 5");
    expect(canonicalClassroomOperationalCode("", "R9.3")).toBe("R 9.3");
  });
});
