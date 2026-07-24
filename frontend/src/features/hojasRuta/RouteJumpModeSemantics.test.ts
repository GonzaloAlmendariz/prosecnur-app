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

    expect(selector).toContain("<GlidingRadioGroup");
    expect(selector).toContain("value={routeJumpMode}");
    expect(selector).toContain("options={routeJumpModeOptions}");
    expect(selector).toContain("onValueChange={(nextMode) => patchConfig({ route_jump_mode: nextMode })}");
    expect(source).not.toContain("selectRouteJumpModeFromKey");
  });
});
