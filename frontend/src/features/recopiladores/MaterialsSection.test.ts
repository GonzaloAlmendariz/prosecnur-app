import { describe, expect, it } from "vitest";

import { materialFieldBinding, materialFieldCanvasLabel } from "./MaterialsSection";

describe("campos semánticos del material", () => {
  it("presenta bindings simples sin alterarlos", () => {
    expect(materialFieldBinding("unit.schedule")).toBe("unit.schedule");
    expect(materialFieldCanvasLabel("unit.schedule")).toBe("unit.schedule");
  });

  it("presenta campos etiquetados del preset sin [object Object]", () => {
    const field = { label: "Horario", binding: "unit.schedule" };
    expect(materialFieldBinding(field)).toBe("unit.schedule");
    expect(materialFieldCanvasLabel(field)).toBe("Horario (unit.schedule)");
  });
});
