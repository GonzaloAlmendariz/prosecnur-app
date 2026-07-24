import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas route-jump mode semantics", () => {
  test("uses exclusive radio semantics with keyboard selection", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const labelIndex = source.indexOf('aria-label="Constante de salto"');
    const selector = source.slice(
      source.lastIndexOf("<", labelIndex),
      source.indexOf('<Field label="Salto manual">', labelIndex),
    );

    expect(selector).toContain("<GlidingTabList");
    expect(selector).toContain('role="radiogroup"');
    expect(selector).toContain('role="radio"');
    expect(selector).toContain("aria-checked={routeJumpMode === option.key}");
    expect(selector).toContain("data-gliding-key={option.key}");
    expect(selector).toContain("onKeyDown={(event) => selectRouteJumpModeFromKey");
    expect(source).toContain(
      "if (nextMode !== routeJumpMode) patchConfig({ route_jump_mode: nextMode })",
    );
  });
});
