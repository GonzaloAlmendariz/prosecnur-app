import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, test } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
// La tira de cifras (E5, revamp 2026-11-02) reemplazó al grid de tarjetas KPI
// y vive en su propio archivo; declara el mismo grupo geométrico.
const sourcePath = path.join(here, "explorar", "TiraCifras.tsx");
const sourceFile = ts.createSourceFile(
  sourcePath,
  fs.readFileSync(sourcePath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function literalAttribute(
  tag: ts.JsxOpeningLikeElement,
  name: string,
): string | undefined {
  const attribute = tag.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name,
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : undefined;
}

function kpiGridTags(): ts.JsxOpeningLikeElement[] {
  const matches: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const classes = literalAttribute(node, "className")?.split(/\s+/) ?? [];
      if (classes.includes("vx-tira")) matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return matches;
}

describe("contrato geométrico de la tira de cifras de Validación > Explorar", () => {
  test("declara la tira de cifras como un grupo de miembros iguales", () => {
    const tags = kpiGridTags();

    expect(tags).toHaveLength(1);
    expect({
      group: literalAttribute(tags[0], "data-qa-geometry-group"),
      contract: literalAttribute(tags[0], "data-qa-geometry-contract"),
    }).toEqual({
      group: "validacion/explorar-kpis",
      contract: "equal",
    });
  });
});

test("cada cifra se declara miembro del grupo", () => {
  const fuente = fs.readFileSync(sourcePath, "utf8");
  expect(fuente).toMatch(/className="vx-cifra" data-qa-geometry-member/);
});
