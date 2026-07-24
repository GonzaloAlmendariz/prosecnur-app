import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

function columnWidth(css: string, column: string): number {
  const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(
      `\\.hojas-ruta-review-table\\.is-replacement-table col\\.${escaped}\\s*\\{[^}]*width\\s*:\\s*(\\d+(?:\\.\\d+)?)%`,
    ),
  );
  return Number(match?.[1] ?? Number.NaN);
}

describe("Hojas delivery replacement-table layout", () => {
  test("reserves a real column for R without over-allocating the table", () => {
    const css = fs.readFileSync(path.join(featureDir, "hojasRuta.css"), "utf8");
    const columns = [
      "is-district",
      "is-route",
      "is-block-id",
      "is-zone",
      "is-nse",
      "is-replaces",
      "is-range",
      "is-households",
      "is-method",
    ];
    const widths = columns.map((column) => columnWidth(css, column));

    expect(widths.every(Number.isFinite)).toBe(true);
    expect(columnWidth(css, "is-route")).toBeGreaterThanOrEqual(7);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(100);
  });
});
