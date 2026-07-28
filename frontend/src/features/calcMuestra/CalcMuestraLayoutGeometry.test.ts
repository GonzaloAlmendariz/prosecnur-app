import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const featureDir = __dirname;

function read(relativePath: string) {
  return fs.readFileSync(path.join(featureDir, relativePath), "utf8");
}

describe("CalcMuestra workbench geometry", () => {
  it("uses the available route width without changing the shared shell", () => {
    const css = read("calcMuestra.css");
    const motorCss = read("motor/motor.css");

    expect(css).toMatch(/\.pulso-main:has\(\.cmv2-frame\)\s*\{[^}]*max-width:\s*none/s);
    expect(css).toMatch(/\.cmv2-commandbar\s*\{[^}]*width:\s*100%/s);
    expect(motorCss).toMatch(/\.rec-resumen-shell\s*\{[^}]*width:\s*100%/s);
  });

  it("keeps one scroll owner in the university desk", () => {
    const css = read("calcMuestra.css");

    expect(css).toMatch(/\.cmv2-workbench\.pulso-context-tab-layout\s*>\s*\.cmv2-main\s*\{[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.cmv2-tab-panel\s*\{[^}]*overflow:\s*auto/s);
  });

  it("declares Variables as an intrinsic data surface for geometry QA", () => {
    const tab = read("universidad/definicion/DefVariablesTab.tsx");
    const card = read("universidad/definicion/VariableMapCard.tsx");
    const css = read("universidad/definicion/definicion.css");

    expect(tab).toContain("data-qa-geometry-group={`calc-variable-${seccion.id}`}");
    expect(tab).toContain('data-qa-geometry-contract="intrinsic"');
    expect(card).toContain("data-qa-geometry-member");
    expect(card).toContain("data-qa-geometry-content");
    expect(css).toMatch(/\.cmv2-defi-var-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
    expect(css).toContain('"head select confirm detail"');
  });
});
