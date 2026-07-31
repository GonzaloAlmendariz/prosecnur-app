import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, test } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, "DataReviewPane.tsx");
const sourceFile = ts.createSourceFile(
  sourcePath,
  fs.readFileSync(sourcePath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function literalAttribute(tag: ts.JsxOpeningLikeElement, name: string): string | undefined {
  const attribute = tag.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name,
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : undefined;
}

function tagsWithClass(className: string): ts.JsxOpeningLikeElement[] {
  const matches: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const classes = literalAttribute(node, "className")?.split(/\s+/) ?? [];
      if (classes.includes(className)) matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return matches;
}

describe("contrato geométrico de la revisión de datos", () => {
  test("declara la lista exacta de secciones como un grupo intrínseco", () => {
    const tags = tagsWithClass("pulso-data-review-section-list");

    expect(tags).toHaveLength(1);
    expect(literalAttribute(tags[0], "data-qa-geometry-group")).toBe(
      "analitica/data-review-sections",
    );
    expect(literalAttribute(tags[0], "data-qa-geometry-contract")).toBe("intrinsic");
  });

  test("declara la barra exacta de comandos como toolbar etiquetada", () => {
    const tags = tagsWithClass("pulso-data-review-command");

    expect(tags).toHaveLength(1);
    expect(literalAttribute(tags[0], "role")).toBe("toolbar");
    expect(literalAttribute(tags[0], "aria-label")).toBe("Comandos de revisión de datos");
  });
});
