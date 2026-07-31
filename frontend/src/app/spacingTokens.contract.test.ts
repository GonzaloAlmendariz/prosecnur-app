import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

interface IdentityFile {
  foundations: {
    spacing: {
      base: number;
      scale: number[];
    };
  };
}

const appDir = path.dirname(fileURLToPath(import.meta.url));
const identity = JSON.parse(
  fs.readFileSync(path.resolve(appDir, "../../../branding/identity.json"), "utf8"),
) as IdentityFile;

function readSpacingDeclarations(): Array<{ name: string; value: string }> {
  const css = fs
    .readFileSync(path.join(appDir, "tokens.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  return [...css.matchAll(/(--pulso-space-(?:base|[a-z0-9-]+))\s*:\s*([^;{}]+);/g)].map(
    ([, name, value]) => ({ name, value: value.trim().replace(/\s+/g, " ") }),
  );
}

describe("escala operativa de espaciado", () => {
  const spacing = identity.foundations.spacing;
  const declarations = readSpacingDeclarations();
  const expectedNames = [
    "--pulso-space-base",
    ...Array.from({ length: 9 }, (_, index) => `--pulso-space-${index + 1}`),
  ];

  test("declara base y nombres 1..9 exactamente una vez", () => {
    expect(spacing.scale).toHaveLength(9);
    expect(declarations.map(({ name }) => name).sort()).toEqual([...expectedNames].sort());
  });

  test("mantiene paridad 1:1 con foundations.spacing de identity.json", () => {
    const expectedValues = [spacing.base, ...spacing.scale].map((value) => `${value}px`);

    expect(declarations.map(({ value }) => value)).toEqual(expectedValues);
  });
});
