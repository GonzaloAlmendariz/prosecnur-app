import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

describe("Home footer controls", () => {
  it("uses legible decorative icons without changing the button names", () => {
    const page = fs.readFileSync(path.join(featureDir, "HomePage.tsx"), "utf8");

    expect(page).toMatch(/<Settings2\s+size=\{14\}\s+aria-hidden="true"\s*\/>/);
    expect(page).toMatch(/<Power\s+size=\{14\}\s+aria-hidden="true"\s*\/>/);
    expect(page).toContain("Configuración");
    expect(page).toContain("Cerrar aplicación");
  });

  it("uses the large shared control height for both footer actions", () => {
    const css = fs.readFileSync(path.join(featureDir, "home-v2.css"), "utf8");
    const rule = css.match(
      /\.home-wrap \.home-footer-notes,\s*\.home-wrap \.home-footer-quit\s*\{([^}]*)\}/,
    )?.[1] ?? "";

    expect(rule).not.toBe("");
    expect(rule).toMatch(/min-height\s*:\s*var\(--pulso-control-height-lg\)\s*;/);
  });
});
