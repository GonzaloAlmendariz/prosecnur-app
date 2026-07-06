import { describe, expect, test } from "vitest";
import type { ProcessingSheetColumn } from "../../api/client";
import {
  columnDisplayKind,
  columnKindLabel,
  isOpenTextMultipleRecodColumn,
  isRecodedColumn,
  isSelectMultipleDummyColumn,
  orderColumnsForCoding,
} from "./ProcessingSheetViewer";

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

  test("treats select-multiple dummies as multiple values for visual coding", () => {
    expect(isSelectMultipleDummyColumn(column("p34.5", { dummy_parent: "p34", type_kind: "sm" }))).toBe(true);
    expect(isSelectMultipleDummyColumn(column("p34_recod.5", { type_kind: "other" }))).toBe(true);
    expect(isSelectMultipleDummyColumn(column("p34/5_recod", { type_kind: "other" }))).toBe(true);
    expect(isSelectMultipleDummyColumn(column("p34_recod", { type_kind: "text" }))).toBe(false);

    expect(columnDisplayKind(column("p34_recod.5", { type_kind: "other" }))).toBe("sm");
    expect(columnDisplayKind(column("p35_recod", { type_kind: "text" }))).toBe("text");
  });

  test("labels open-text recodes expanded as multiple categories with the hybrid tone", () => {
    const textToMultiple = column("p35_recod.1", {
      type: "text",
      type_base: "dummy_select_multiple",
      type_kind: "sm",
      is_recoded: true,
      source_type_kind: "text",
      dummy_parent: "p35",
    });
    const nativeMultiple = column("p34_recod.1", {
      type: "select_multiple p34",
      type_base: "dummy_select_multiple",
      type_kind: "sm",
      is_recoded: true,
      source_type_kind: "sm",
      dummy_parent: "p34",
    });

    expect(isOpenTextMultipleRecodColumn(textToMultiple)).toBe(true);
    expect(columnKindLabel(textToMultiple)).toBe("Abierta a múltiple");
    expect(isOpenTextMultipleRecodColumn(nativeMultiple)).toBe(false);
    expect(columnKindLabel(nativeMultiple)).toBe("Múltiple");
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
