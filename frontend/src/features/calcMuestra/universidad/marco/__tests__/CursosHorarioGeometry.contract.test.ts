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

function tagsWithClass(source: ParsedSource, className: string): ts.JsxOpeningLikeElement[] {
  const matches: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const classes = literalAttribute(source, node, "className")?.split(/\s+/) ?? [];
      if (classes.includes(className)) matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source.file);
  return matches;
}

function tagName(source: ParsedSource, tag: ts.JsxOpeningLikeElement): string {
  return tag.tagName.getText(source.file);
}

const baseGlobalSource = parse("../CursosHorarioBaseGlobal.tsx");
const composicionSource = parse("../../criterios/CriterioComposicionCard.tsx");
const marcoTabSource = parse("../CursosHorarioMarcoTab.tsx");
const decisionSource = parse("../FacultadDecisionBloque.tsx");
const aulasFinalesSource = parse("../AulasFinalesCard.tsx");

describe("C1 geométrico de Cursos-horario", () => {
  it("declara las cuatro colecciones reales como fronteras intrínsecas distintas", () => {
    const expected = [
      {
        source: baseGlobalSource,
        className: "cmv2-chfp-global-grid",
        tag: "div",
        group: "calc-muestra/criterios-ch-globales",
      },
      {
        source: composicionSource,
        className: "cmv2-crit-pasos",
        tag: "ol",
        group: "calc-muestra/composicion-ch-pasos",
      },
      {
        source: marcoTabSource,
        className: "cmv2-chfp-bloques",
        tag: "div",
        group: "calc-muestra/facultades-ch",
      },
      {
        source: decisionSource,
        className: "cmv2-chfp-decision",
        tag: "div",
        group: "calc-muestra/decision-ch-facultad",
      },
    ];

    const boundaries = expected.map((boundary) => ({
      ...boundary,
      tags: tagsWithClass(boundary.source, boundary.className),
    }));

    expect(
      boundaries.map(({ className, tags }) => ({ className, definitions: tags.length })),
      "cada frontera debe tener una única definición fuente",
    ).toEqual(expected.map(({ className }) => ({ className, definitions: 1 })));
    expect(boundaries.map(({ source, tags }) => ({
      tag: tagName(source, tags[0]),
      group: literalAttribute(source, tags[0], "data-qa-geometry-group"),
      contract: literalAttribute(source, tags[0], "data-qa-geometry-contract"),
    }))).toEqual(expected.map(({ tag, group }) => ({
      tag,
      group,
      contract: "intrinsic",
    })));
  });

  it("declara ambos pasos de composición como miembros con capacidad propia", () => {
    const pasos = tagsWithClass(composicionSource, "cmv2-crit-paso");

    expect(pasos).toHaveLength(2);
    expect(pasos.map((tag) => ({
      tag: tagName(composicionSource, tag),
      member: hasAttribute(composicionSource, tag, "data-qa-geometry-member"),
      capacity: literalAttribute(composicionSource, tag, "data-qa-geometry-capacity"),
    }))).toEqual([
      { tag: "li", member: true, capacity: "owned" },
      { tag: "li", member: true, capacity: "owned" },
    ]);
  });

  it("declara las variantes de criterio como miembros sin atribuirles capacidad propia", () => {
    const decisionVariants = tagsWithClass(decisionSource, "cmv2-chfp-crit");
    const aulasFinalesVariants = tagsWithClass(aulasFinalesSource, "cmv2-chfp-crit");

    expect(decisionVariants, "variantes definidas en FacultadDecisionBloque").toHaveLength(4);
    expect(aulasFinalesVariants, "variante final definida en AulasFinalesCard").toHaveLength(1);

    const variants = [
      ...decisionVariants.map((tag) => ({ source: decisionSource, tag })),
      ...aulasFinalesVariants.map((tag) => ({ source: aulasFinalesSource, tag })),
    ];
    expect(variants.map(({ source, tag }) => ({
      tag: tagName(source, tag),
      member: hasAttribute(source, tag, "data-qa-geometry-member"),
      hasCapacityAttribute: hasAttribute(source, tag, "data-qa-geometry-capacity"),
      capacity: literalAttribute(source, tag, "data-qa-geometry-capacity"),
    }))).toEqual(variants.map(() => ({
      tag: "section",
      member: true,
      hasCapacityAttribute: false,
      capacity: undefined,
    })));
  });
});
