import { describe, expect, it } from "vitest";
import { processingBaseScopePresentation } from "./baseScopeModel";

describe("processingBaseScopePresentation", () => {
  it.each([
    [undefined, 0, "empty", false, false, "Sin bases"],
    ["independent_siblings", 1, "single", false, false, "Base única"],
    ["independent_siblings", 2, "independent", true, true, "Bases independientes"],
    ["independent_siblings", 7, "independent", true, true, "Bases independientes"],
    ["multibase", 2, "combined", false, false, "Bases combinadas"],
  ])(
    "mode=%s bases=%s => %s",
    (processingMode, baseCount, scope, showBasePicker, showSharedReports, summaryLabel) => {
      expect(processingBaseScopePresentation(processingMode, baseCount)).toEqual({
        scope,
        showBasePicker,
        showSharedReports,
        summaryLabel,
      });
    },
  );
});
