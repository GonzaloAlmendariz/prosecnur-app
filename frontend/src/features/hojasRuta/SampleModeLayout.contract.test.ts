import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

function cssRuleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("Hojas sample-mode card layout", () => {
  test("stacks the title and description with enough room to avoid overlap", () => {
    const css = fs.readFileSync(path.join(featureDir, "hojasRuta.css"), "utf8");
    const buttonRule = cssRuleBody(css, ".hojas-ruta-sample-mode-cards button");

    expect(buttonRule).toMatch(/display\s*:\s*grid\s*;/);
    expect(buttonRule).toMatch(/align-content\s*:\s*center\s*;/);
    expect(buttonRule).toMatch(/gap\s*:\s*3px\s*;/);
    expect(buttonRule).toMatch(/min-height\s*:\s*64px\s*;/);
    expect(css).toMatch(
      /\.hojas-ruta-sample-mode-cards button span\s*\{[^}]*margin-top\s*:\s*0\s*;/,
    );
  });

  test("keeps the active treatment tied to the Hojas module accent", () => {
    const css = fs.readFileSync(path.join(featureDir, "hojasRuta.css"), "utf8");
    const activeRule = cssRuleBody(
      css,
      ".hojas-ruta-frame .hojas-ruta-sample-mode-cards button.is-active",
    );

    expect(activeRule).toContain("var(--module-accent)");
    expect(activeRule).toContain("var(--module-accent-soft)");
  });
});
