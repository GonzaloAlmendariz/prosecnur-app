import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const featureDir = __dirname;
const page = fs.readFileSync(path.join(featureDir, "HojasRutaPage.tsx"), "utf8");

describe("Hojas de Ruta cartographic layout contract", () => {
  it("keeps the frozen page within its growth gate", () => {
    expect(page.split("\n").length - 1).toBeLessThanOrEqual(9001);
  });

  it("exposes measurable map, subject, overlay, and primary-action hooks", () => {
    expect(page).toContain('data-audit-map-viewport="territorio"');
    expect(page).toContain('data-audit-map-viewport="manzanas"');
    expect(page).toContain("data-audit-map-subject");
    expect(page).toContain('data-audit-map-overlay="zoom"');
    expect(page).toContain('data-audit-map-overlay="legend"');
    expect(page).toContain('data-audit-map-overlay="info"');
    expect(page).toContain("data-audit-primary-action");
  });

  it("uses proportional map fitting from the cartographic viewport model", () => {
    expect(page).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(page).toContain("paddedGeometryViewBox");
    expect(page).toContain("uniformContainTransform");
    expect(page).toContain("containerPointToLogical");
  });
});
