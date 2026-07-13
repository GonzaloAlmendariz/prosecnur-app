import { describe, expect, test } from "vitest";
import type { XlsformEditorSheet } from "../types";
import { parseBuilderStructure } from "../parsing/buildIndex";
import { computeEndMove } from "./outlineUtils";

function structFrom(rows: string[][]) {
  const survey: XlsformEditorSheet = {
    name: "survey",
    columns: ["type", "name", "label"],
    rows,
  };
  return parseBuilderStructure(survey);
}

describe("computeEndMove — arrastre del cierre de sección", () => {
  // 0 begin, 1 q1, 2 q2, 3 end, 4 q3
  const flat = structFrom([
    ["begin_group", "sec", "Sección"],
    ["text", "q1", "P1"],
    ["text", "q2", "P2"],
    ["end_group", "", ""],
    ["text", "q3", "P3"],
  ]);

  test("mueve el cierre hacia abajo para absorber la pregunta siguiente", () => {
    const plan = computeEndMove(flat, 3, 4, false); // soltar después de q3
    expect(plan).not.toBeNull();
    expect(plan!.fromStart).toBe(3);
    expect(plan!.count).toBe(1);
    expect(plan!.insertAt).toBe(4);
  });

  test("NO permite cruzar el cierre antes de su begin", () => {
    // soltar antes del begin (row 0)
    expect(computeEndMove(flat, 3, 0, true)).toBeNull();
  });

  test("permite subir el cierre para dejar la sección vacía (justo tras el begin)", () => {
    const plan = computeEndMove(flat, 3, 1, true); // antes de q1 → tras el begin
    expect(plan).not.toBeNull();
    expect(plan!.insertAt).toBe(1);
  });

  // Sección A con sección hija B anidada:
  // 0 beginA, 1 beginB, 2 q1, 3 endB, 4 endA, 5 q2
  const nested = structFrom([
    ["begin_group", "A", "A"],
    ["begin_group", "B", "B"],
    ["text", "q1", "P1"],
    ["end_group", "", ""],
    ["end_group", "", ""],
    ["text", "q2", "P2"],
  ]);

  test("NO permite que el cierre de A caiga dentro de la sección hija B", () => {
    // endA = row 4; soltar dentro de B (después de q1, row 2)
    expect(computeEndMove(nested, 4, 2, false)).toBeNull();
  });

  test("permite mover el cierre de A hacia abajo para absorber q2", () => {
    const plan = computeEndMove(nested, 4, 5, false);
    expect(plan).not.toBeNull();
    expect(plan!.insertAt).toBe(5);
  });
});
