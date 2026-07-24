import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

function cssRuleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("Bitácora panel scroll ownership", () => {
  test("keeps PageFrame in fill mode with panel-owned scrolling", () => {
    const page = fs.readFileSync(path.join(featureDir, "BitacoraPage.tsx"), "utf8");
    const pageFrame = page.match(/<PageFrame[\s\S]*?>/)?.[0] ?? "";

    expect(pageFrame, "Bitácora must keep a PageFrame root").not.toBe("");
    expect(pageFrame).toMatch(/\bbodyMode="fill"/);
    expect(pageFrame).toMatch(/\bscrollOwner="panels"/);
  });

  test("gives only the compact logbook grid the missing scroll owner", () => {
    const css = fs.readFileSync(path.join(featureDir, "bitacora.css"), "utf8");
    const selector = ".bitacora-body > .diseno-bitacora-grid";
    const rule = cssRuleBody(css, selector);

    expect(
      rule,
      `${selector} must own scrolling without capturing .plan-timeline or .bcal`,
    ).not.toBe("");
    expect(rule, `${selector} must be allowed to shrink inside the fill layout`).toMatch(
      /(?:^|;)\s*min-height\s*:\s*0\s*;/,
    );
    expect(rule, `${selector} must expose vertical overflow`).toMatch(
      /(?:^|;)\s*overflow-y\s*:\s*auto\s*;/,
    );
  });

  test("bridges the Bitácora module accent into its reused logbook controls", () => {
    const css = fs.readFileSync(path.join(featureDir, "bitacora.css"), "utf8");
    const rule = cssRuleBody(css, ".bitacora-shell");

    expect(rule).toMatch(/--diseno-accent\s*:\s*var\(--bitacora-accent\)\s*;/);
    expect(rule).toMatch(/--diseno-accent-soft\s*:\s*var\(--bitacora-accent-soft\)\s*;/);
    expect(rule).toMatch(/--diseno-accent-border\s*:\s*var\(--bitacora-accent-border\)\s*;/);
  });
});
