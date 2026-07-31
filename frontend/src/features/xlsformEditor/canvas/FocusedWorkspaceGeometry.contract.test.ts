import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const canvasDir = path.dirname(fileURLToPath(import.meta.url));
const workspace = fs.readFileSync(path.join(canvasDir, "FocusedWorkspace.tsx"), "utf8");
const xlsformCss = fs
  .readFileSync(path.resolve(canvasDir, "../styles/xlsform-v2.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function exactDeclaration(block: string, property: string): string | undefined {
  return block.split(";").find((declaration) => {
    const separator = declaration.indexOf(":");
    return separator >= 0 && declaration.slice(0, separator).trim() === property;
  });
}

describe("contrato geométrico del quicklook XLSForm", () => {
  test("declara el grid persistente como un grupo de filas iguales", () => {
    const gridTag = workspace.match(
      /<div\b(?=[^>]*\bclassName="pulso-focus-quicklook-grid")[^>]*>/,
    )?.[0];

    expect(gridTag).toBeDefined();
    expect(gridTag).toContain('data-qa-geometry-group="xlsform/focus-quicklook"');
    expect(gridTag).toContain('data-qa-geometry-contract="equal"');
  });

  test("iguala las filas dentro de la regla CSS propia del quicklook", () => {
    const gridRule = xlsformCss.match(/\.pulso-focus-quicklook-grid\s*\{([^{}]*)\}/)?.[1];

    expect(gridRule).toBeDefined();
    expect(exactDeclaration(gridRule ?? "", "grid-auto-rows")?.trim()).toBe(
      "grid-auto-rows: 1fr",
    );
  });
});
