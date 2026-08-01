import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type ParsedSource = {
  file: ts.SourceFile;
};

const here = path.dirname(fileURLToPath(import.meta.url));

function parse(relativePath: string): ParsedSource {
  const sourcePath = path.resolve(here, relativePath);
  return {
    file: ts.createSourceFile(
      sourcePath,
      fs.readFileSync(sourcePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
  };
}

function literalAttribute(
  source: ParsedSource,
  tag: ts.JsxOpeningLikeElement,
  name: string,
): string | undefined {
  const attribute = tag.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(source.file) === name,
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : undefined;
}

function hasAttribute(source: ParsedSource, tag: ts.JsxOpeningLikeElement, name: string): boolean {
  return tag.attributes.properties.some(
    (property) => ts.isJsxAttribute(property) && property.name.getText(source.file) === name,
  );
}

function tagsWithClass(
  source: ParsedSource,
  className: string,
  root: ts.Node = source.file,
): ts.JsxOpeningLikeElement[] {
  const matches: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const classes = literalAttribute(source, node, "className")?.split(/\s+/) ?? [];
      if (classes.includes(className)) matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return matches;
}

const cifraSource = parse("../../ui/CifraMotor.tsx");
const controlesSource = parse("../controles.tsx");

describe("C1 geométrico de las colecciones de Criterios", () => {
  it("declara CifraFila como un grupo persistente de cifras iguales", () => {
    const filas = tagsWithClass(cifraSource, "cmv2-uni-cifra-fila");

    expect(filas).toHaveLength(1);
    expect({
      group: literalAttribute(cifraSource, filas[0], "data-qa-geometry-group"),
      contract: literalAttribute(cifraSource, filas[0], "data-qa-geometry-contract"),
    }).toEqual({
      group: "calc-muestra/cifra-fila",
      contract: "equal",
    });
  });

  it("declara las listas plana y anidada como colecciones intrínsecas propias", () => {
    const listas = tagsWithClass(controlesSource, "cmv2-crit-list");

    expect(listas).toHaveLength(2);
    expect(listas.map((tag) => ({
      group: literalAttribute(controlesSource, tag, "data-qa-geometry-group"),
      contract: literalAttribute(controlesSource, tag, "data-qa-geometry-contract"),
    }))).toEqual([
      { group: "calc-muestra/criterios-categorias", contract: "intrinsic" },
      { group: "calc-muestra/criterios-subcategorias", contract: "intrinsic" },
    ]);
  });

  it("declara cada ítem como miembro que posee su capacidad táctil", () => {
    const items = tagsWithClass(controlesSource, "cmv2-crit-item");

    expect(items).toHaveLength(2);
    expect(items.map((tag) => ({
      member: hasAttribute(controlesSource, tag, "data-qa-geometry-member"),
      capacity: literalAttribute(controlesSource, tag, "data-qa-geometry-capacity"),
    }))).toEqual([
      { member: true, capacity: "owned" },
      { member: true, capacity: "owned" },
    ]);
  });
});
