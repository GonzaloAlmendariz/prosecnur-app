import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas route-start corner semantics", () => {
  test("uses exclusive radio semantics with keyboard selection", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Esquina inicial"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf('<div className="hojas-ruta-route-jump-group">', labelIndex),
    );

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={routeStartCorner}");
    expect(selector).toContain("options={routeStartCornerOptions}");
    expect(selector).toContain("onValueChange={(nextCorner) => patchConfig({ route_start_corner: nextCorner })}");
    expect(source).not.toContain("selectRouteStartCornerFromKey");
  });
});
