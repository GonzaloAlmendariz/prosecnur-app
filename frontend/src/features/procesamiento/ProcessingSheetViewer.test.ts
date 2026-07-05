import { describe, expect, test } from "vitest";
import type { ProcessingSheetColumn } from "../../api/client";
import { isRecodedColumn, orderColumnsForCoding } from "./ProcessingSheetViewer";

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

  test("trusts explicit recoding metadata over names", () => {
    expect(isRecodedColumn({ key: "p2_recod", is_recoded: false })).toBe(false);
    expect(isRecodedColumn({ key: "p2", is_recoded: true })).toBe(true);
  });

  test("keeps recoded variables next to their original variable", () => {
    const columns = [
      column("record_id"),
      column("p2"),
      column("p3"),
      column("p2_recod", { is_recoded: true, raw_parent: "p2" }),
      column("p4"),
      column("p4_other_recod", { is_recoded: true, raw_parent: "p4_other" }),
    ];

    expect(orderColumnsForCoding(columns, true).map((c) => c.key)).toEqual([
      "record_id",
      "p2",
      "p2_recod",
      "p3",
      "p4",
      "p4_other_recod",
    ]);
  });
});

function column(key: string, patch: Partial<ProcessingSheetColumn> = {}): ProcessingSheetColumn {
  return {
    key,
    label: key,
    type: "",
    type_base: "",
    type_kind: "other",
    coded: false,
    ...patch,
  };
}
