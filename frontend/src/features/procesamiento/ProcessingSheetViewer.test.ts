import { describe, expect, test } from "vitest";
import { isRecodedColumn } from "./ProcessingSheetViewer";

describe("ProcessingSheetViewer helpers", () => {
  test("detects recoded columns without coloring original variables", () => {
    [
      "p2_recod",
      "p2_recod.1",
      "p2.recod.1",
      "p2/recod/1",
      "p2-1-recod",
      "recod",
    ].forEach((key) => {
      expect(isRecodedColumn({ key })).toBe(true);
    });

    [
      "p2",
      "p2_original",
      "record_id",
      "p2_recodificar",
      "codigo_pucp",
    ].forEach((key) => {
      expect(isRecodedColumn({ key })).toBe(false);
    });
  });
});
