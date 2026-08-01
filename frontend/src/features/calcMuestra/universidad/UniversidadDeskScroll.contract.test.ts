import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));

function parse(relativePath: string): ts.SourceFile {
  const absolutePath = path.resolve(here, relativePath);
  return ts.createSourceFile(
    absolutePath,
    fs.readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function callsIn(
  root: ts.Node,
  predicate: (call: ts.CallExpression) => boolean,
): ts.CallExpression[] {
  const matches: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return matches;
}

function callName(call: ts.CallExpression): string | null {
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
  return null;
}

function literalClassNames(
  source: ts.SourceFile,
  tag: ts.JsxOpeningLikeElement,
): string[] {
  const attribute = tag.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(source) === "className",
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text.split(/\s+/)
    : [];
}

function jsxExpressionAttribute(
  source: ts.SourceFile,
  tag: ts.JsxOpeningLikeElement,
  name: string,
): string | null {
  const attribute = tag.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(source) === name,
  );
  if (
    !attribute?.initializer
    || !ts.isJsxExpression(attribute.initializer)
    || !attribute.initializer.expression
  ) return null;
  return attribute.initializer.expression.getText(source);
}

function tagsWithClass(source: ts.SourceFile, className: string) {
  const matches: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && literalClassNames(source, node).includes(className)
    ) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return matches;
}

function activePanelOwner(source: ts.SourceFile): string | null {
  const panels = tagsWithClass(source, "cmv2-tab-panel");
  const owners = panels.map((panel) => jsxExpressionAttribute(source, panel, "ref"));
  if (owners.some((owner) => owner === null)) return null;
  const unique = new Set(owners);
  return unique.size === 1 ? owners[0] : null;
}

function objectProperties(argument: ts.Expression | undefined) {
  if (!argument || !ts.isObjectLiteralExpression(argument)) return new Map<string, ts.Expression>();
  return new Map(
    argument.properties
      .filter((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property))
      .map((property) => [property.name.getText(), property.initializer]),
  );
}

const deskSource = parse("./UniversidadDesk.tsx");
const pageSource = parse("../CalcMuestraPage.tsx");

describe("UniversidadDesk — ownership del scroll del panel activo", () => {
  it("resetea antes de pintar solo cuando cambia la superficie navegada", () => {
    const effects = callsIn(deskSource, (call) => callName(call) === "useLayoutEffect");

    expect(effects, "falta el useLayoutEffect dueño del reset").toHaveLength(1);
    const effect = effects[0];
    const callback = effect?.arguments[0];
    const dependencies = effect?.arguments[1];
    expect(callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))).toBe(true);
    expect(dependencies && ts.isArrayLiteralExpression(dependencies)).toBe(true);
    if (
      !callback
      || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
      || !dependencies
      || !ts.isArrayLiteralExpression(dependencies)
    ) return;

    expect(dependencies.elements.map((dependency) => dependency.getText(deskSource))).toEqual([
      "selectedSection",
      "activeContextTabKey",
    ]);

    const owner = activePanelOwner(deskSource);
    expect(owner, "el efecto debe leer el ref que poseen los paneles").not.toBeNull();
    if (!owner) return;
    expect(callback.getText(deskSource)).toContain(`${owner}.current`);

    const scrollCalls = callsIn(callback, (call) => callName(call) === "scrollTo");
    expect(scrollCalls).toHaveLength(1);
    const options = objectProperties(scrollCalls[0]?.arguments[0]);
    expect([...options.keys()].sort()).toEqual(["behavior", "left", "top"]);
    expect(options.get("top")?.getText(deskSource)).toBe("0");
    expect(options.get("left")?.getText(deskSource)).toBe("0");
    const behavior = options.get("behavior");
    expect(behavior && ts.isStringLiteral(behavior) ? behavior.text : null).toBe("auto");
    expect(callsIn(callback, (call) => callName(call) === "focus")).toEqual([]);
  });

  it("da el mismo ref local a los cinco paneles condicionales", () => {
    const panels = tagsWithClass(deskSource, "cmv2-tab-panel");
    const owners = panels.map((panel) => jsxExpressionAttribute(deskSource, panel, "ref"));

    expect(panels).toHaveLength(5);
    expect(owners.filter(Boolean), "cada panel debe poseer el ref activo").toHaveLength(5);
    expect(new Set(owners).size).toBe(1);
    const owner = owners[0];
    if (!owner) return;

    const declarations: ts.VariableDeclaration[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node)
        && node.name.getText(deskSource) === owner
        && node.initializer
        && ts.isCallExpression(node.initializer)
        && callName(node.initializer) === "useRef"
      ) declarations.push(node);
      ts.forEachChild(node, visit);
    };
    visit(deskSource);
    expect(declarations, "el owner compartido debe ser un useRef local").toHaveLength(1);
  });

  it("retira los resets de cmv2-main condicionados al desk universitario", () => {
    const legacyUniversityResets = callsIn(
      pageSource,
      (call) => callName(call) === "scrollTo" && call.getText(pageSource).includes(".cmv2-main"),
    ).filter((call) => {
      for (let parent: ts.Node | undefined = call.parent; parent; parent = parent.parent) {
        if (
          ts.isIfStatement(parent)
          && parent.expression.getText(pageSource).includes("opinion_universitaria")
        ) return true;
      }
      return false;
    });

    expect(legacyUniversityResets.map((call) => call.getText(pageSource))).toEqual([]);
  });
});
