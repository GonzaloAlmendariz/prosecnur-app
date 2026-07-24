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

    expect(selector).toContain("<GlidingTabList");
    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked={routeStartCorner === option.key}");
    expect(selector).toContain("data-gliding-key={option.key}");
    expect(selector).toContain("onKeyDown={(event) => selectRouteStartCornerFromKey");
    expect(source).toContain(
      "if (nextCorner !== routeStartCorner) patchConfig({ route_start_corner: nextCorner })",
    );
  });
});
