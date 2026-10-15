import { describe, expect, it } from "vitest";
import { hasPaperOverrides, offersPaperSettings } from "./paperSettings";

describe("ajustes de papel en el inspector", () => {
  it("se ofrecen siempre para lo que se imprime, aunque no tenga paper_*", () => {
    for (const kind of ["question", "note", "section", "repeat"] as const) {
      expect(offersPaperSettings({ kind })).toBe(true);
    }
  });

  it("un cálculo sólo los muestra si ya trae alguno", () => {
    expect(offersPaperSettings({ kind: "calculate" })).toBe(false);
    expect(offersPaperSettings({ kind: "calculate", paperLabel: "X" })).toBe(true);
  });

  it("abre plegado salvo que la fila tenga un ajuste, incluidos subgrupo y letra", () => {
    expect(hasPaperOverrides({ kind: "question", paperGroup: "  " })).toBe(false);
    expect(hasPaperOverrides({ kind: "question", paperSubgroup: "D.4" })).toBe(true);
    expect(hasPaperOverrides({ kind: "question", paperSubletter: "a" })).toBe(true);
  });
});
