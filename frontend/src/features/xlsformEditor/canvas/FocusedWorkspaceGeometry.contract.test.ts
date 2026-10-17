import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

// El resumen de la pregunta (antes «quicklook», revamp 2026-10-16) es una grilla de cuatro contenedores
// que debe verse pareja: se declara como grupo de filas iguales y su CSS lo cumple.
const canvasDir = path.dirname(fileURLToPath(import.meta.url));
const resumen = fs.readFileSync(path.join(canvasDir, "constructor/ResumenPregunta.tsx"), "utf8");
const css = fs
  .readFileSync(path.join(canvasDir, "constructor/resumenPregunta.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function exactDeclaration(block: string, property: string): string | undefined {
  return block.split(";").find((declaration) => {
    const separator = declaration.indexOf(":");
    return separator >= 0 && declaration.slice(0, separator).trim() === property;
  });
}

describe("contrato geométrico del resumen de la pregunta", () => {
  test("declara la grilla como un grupo de filas iguales", () => {
    const gridTag = resumen.match(/<div\b(?=[^>]*\bclassName="xfr-resumen")[^>]*>/)?.[0];
    expect(gridTag).toBeDefined();
    expect(gridTag).toContain('data-qa-geometry-group="xlsform/resumen-pregunta"');
    expect(gridTag).toContain('data-qa-geometry-contract="equal"');
  });

  test("iguala las filas en su propia regla CSS", () => {
    const gridRule = css.match(/\.xfr-resumen\s*\{([^{}]*)\}/)?.[1];
    expect(gridRule).toBeDefined();
    expect(exactDeclaration(gridRule ?? "", "grid-auto-rows")?.trim()).toBe("grid-auto-rows: 1fr");
  });
});
