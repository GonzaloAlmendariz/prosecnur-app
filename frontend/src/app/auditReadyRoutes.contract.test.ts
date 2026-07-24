import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { PROSECNUR_MODULES } from "../lib/modules";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type JsxTag = ts.JsxOpeningLikeElement;

type RouteRoot = {
  sourceFile: ts.SourceFile;
  tag: JsxTag;
};

function parseRoute(relativePath: string): ts.SourceFile {
  const file = path.join(srcDir, relativePath);
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function defaultPageRoot(relativePath: string, expectedTag: string): RouteRoot {
  const sourceFile = parseRoute(relativePath);
  const component = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) === true,
  );

  expect(component, `${relativePath} must keep a default page function`).toBeDefined();

  const rootReturns = component?.body?.statements.filter(ts.isReturnStatement) ?? [];
  const rootReturn = rootReturns[rootReturns.length - 1];
  let expression = rootReturn?.expression;
  while (expression && ts.isParenthesizedExpression(expression)) expression = expression.expression;

  const tag = expression && ts.isJsxElement(expression)
    ? expression.openingElement
    : expression && ts.isJsxSelfClosingElement(expression)
      ? expression
      : undefined;

  expect(tag, `${relativePath} must have a JSX page root`).toBeDefined();
  expect(tag?.tagName.getText(sourceFile), `${relativePath} page root`).toBe(expectedTag);

  return { sourceFile, tag: tag! };
}

function attribute(tag: JsxTag, name: string): ts.JsxAttribute | undefined {
  return tag.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function readinessValue(
  tag: JsxTag,
  name: "auditReady" | "data-audit-ready",
  routeLabel: string,
): ts.Expression | ts.StringLiteral {
  const attr = attribute(tag, name);
  expect(attr, `${routeLabel} root must publish ${name}`).toBeDefined();
  expect(attr?.initializer, `${routeLabel} ${name} must have an explicit semantic value`).toBeDefined();

  if (attr?.initializer && ts.isJsxExpression(attr.initializer)) {
    expect(
      attr.initializer.expression,
      `${routeLabel} ${name} must not use the ambiguous shorthand boolean`,
    ).toBeDefined();
    return attr.initializer.expression!;
  }

  return attr!.initializer as ts.StringLiteral;
}

function visit(node: ts.Node, predicate: (candidate: ts.Node) => boolean): boolean {
  if (predicate(node)) return true;
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && visit(child, predicate)) found = true;
  });
  return found;
}

function references(node: ts.Node, name: string): boolean {
  return visit(node, (candidate) => ts.isIdentifier(candidate) && candidate.text === name);
}

function stringValues(node: ts.Node): string[] {
  const values: string[] = [];
  const collect = (candidate: ts.Node) => {
    if (ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate)) {
      values.push(candidate.text);
    } else if (
      ts.isTemplateHead(candidate) ||
      ts.isTemplateMiddle(candidate) ||
      ts.isTemplateTail(candidate)
    ) {
      values.push(candidate.text);
    }
    ts.forEachChild(candidate, collect);
  };
  collect(node);
  return values;
}

function hasGuardExpression(node: ts.Node): boolean {
  return visit(
    node,
    (candidate) =>
      ts.isConditionalExpression(candidate) ||
      (ts.isBinaryExpression(candidate) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(candidate.operatorToken.kind)),
  );
}

function hasNegatedReference(node: ts.Node, name: string): boolean {
  return visit(
    node,
    (candidate) =>
      ts.isPrefixUnaryExpression(candidate) &&
      candidate.operator === ts.SyntaxKind.ExclamationToken &&
      references(candidate.operand, name),
  );
}

function expectSemanticReadiness(
  value: ts.Node,
  routeLabel: string,
  semanticValue: string,
): void {
  const ambiguousValues = stringValues(value).filter(
    (literal) => literal === "true" || literal === "false",
  );
  const isBareBoolean =
    value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword;

  expect(
    isBareBoolean,
    `${routeLabel} readiness must identify the route, not use a bare boolean`,
  ).toBe(false);
  expect(
    ambiguousValues,
    `${routeLabel} readiness must not use the ambiguous string literals "true"/"false"`,
  ).toEqual([]);
  expect(stringValues(value), `${routeLabel} semantic readiness key`).toContain(semanticValue);
  expect(hasGuardExpression(value), `${routeLabel} readiness must be guarded by loaded state`).toBe(true);
}

function expectNegatedGuard(value: ts.Node, routeLabel: string, name: string): void {
  expect(
    hasNegatedReference(value, name),
    `${routeLabel} readiness must stay absent while ${name} is truthy`,
  ).toBe(true);
}

function hasStateFallback(node: ts.Node): boolean {
  return visit(node, (candidate) => {
    if (!ts.isBinaryExpression(candidate)) return false;
    if (
      candidate.operatorToken.kind !== ts.SyntaxKind.BarBarToken &&
      candidate.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken
    ) {
      return false;
    }
    return (
      (references(candidate.left, "state") && references(candidate.right, "calcState")) ||
      (references(candidate.left, "calcState") && references(candidate.right, "state"))
    );
  });
}

function literalClassNames(tag: JsxTag): string[] {
  const className = attribute(tag, "className")?.initializer;
  return className && ts.isStringLiteral(className)
    ? className.text.split(/\s+/).filter(Boolean)
    : [];
}

function bitacoraKeys(): string[] {
  return PROSECNUR_MODULES
    .find((module) => module.slug === "diseno-estudio")
    ?.sections.map((section) => section.id) ?? [];
}

function hasBitacoraTabKey(node: ts.Node): boolean {
  return visit(
    node,
    (candidate) =>
      ts.isTemplateExpression(candidate) &&
      candidate.head.text === "bitacora-" &&
      candidate.templateSpans.length === 1 &&
      ts.isIdentifier(candidate.templateSpans[0].expression) &&
      candidate.templateSpans[0].expression.text === "tab" &&
      candidate.templateSpans[0].literal.text === "",
  );
}

function terminalReadinessKeys(relativePaths: string[], prefix: string): string[] {
  const keys = relativePaths.flatMap((relativePath) => {
    const source = fs.readFileSync(path.join(srcDir, relativePath), "utf8");
    return [...source.matchAll(/data-audit-ready\s*=\s*(?:"([^"]+)"|\{\s*"([^"]+)"\s*\})/g)]
      .map((match) => match[1] ?? match[2])
      .filter((value) => value.startsWith(prefix));
  });
  return [...new Set(keys)].sort();
}

function terminalReadinessCount(relativePath: string, key: string): number {
  const source = fs.readFileSync(path.join(srcDir, relativePath), "utf8");
  const marker = `data-audit-ready="${key}"`;
  return source.split(marker).length - 1;
}

function hasDirectKeyScope(relativePath: string, names: string[]): boolean {
  const sourceFile = parseRoute(relativePath);
  return visit(sourceFile, (candidate) => {
    if (!ts.isJsxAttribute(candidate) || candidate.name.getText(sourceFile) !== "key") return false;
    const initializer = candidate.initializer;
    if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) return false;
    return names.every((name) => references(initializer.expression!, name));
  });
}

function compactExpression(node: ts.Node): string {
  return node.getText().replace(/\s+/g, "");
}

describe("audit-ready route root contract", () => {
  test("Codificación and Validación keep readiness out of their PageFrame shells", () => {
    const shells = [
      ["Codificación", "features/codificacion/CodificacionPage.tsx"],
      ["Validación", "features/validacion/ValidacionPage.tsx"],
    ] as const;
    const premature = shells.flatMap(([label, relativePath]) => {
      const { tag } = defaultPageRoot(relativePath, "PageFrame");
      return attribute(tag, "auditReady") ? [label] : [];
    });

    expect(premature, "PageFrame shells publish readiness before their active panel").toEqual([]);
  });

  test("Codificación and Validación expose all exact terminal panel keys", () => {
    expect({
      codificacion: terminalReadinessKeys([
        "features/codificacion/PreguntasLanding.tsx",
        "features/codificacion/CodificarWizard.tsx",
        "features/codificacion/RespuestasCodificador.tsx",
        "features/codificacion/IntegerCodificador.tsx",
        "features/codificacion/CodingConfigActions.tsx",
        "features/codificacion/AdaptarPane.tsx",
      ], "codificacion-"),
      validacion: terminalReadinessKeys([
        "features/validacion/tabs/ExplorarTab.tsx",
        "features/validacion/tabs/InstrumentoTab.tsx",
        "features/validacion/tabs/ReglasCustomTab.tsx",
        "features/validacion/tabs/LimpiezaTab.tsx",
      ], "validacion-"),
    }, "Loaded terminal panels must own the semantic readiness keys").toEqual({
      codificacion: [
        "codificacion-adaptar",
        "codificacion-codificar",
        "codificacion-matrices",
        "codificacion-organizar",
      ],
      validacion: [
        "validacion-explorar",
        "validacion-instrumento",
        "validacion-limpieza",
        "validacion-reglas_custom",
      ],
    });

    expect({
      preguntas: terminalReadinessCount(
        "features/codificacion/PreguntasLanding.tsx",
        "codificacion-organizar",
      ),
      wizard: terminalReadinessCount(
        "features/codificacion/CodificarWizard.tsx",
        "codificacion-codificar",
      ),
      respuestas: terminalReadinessCount(
        "features/codificacion/RespuestasCodificador.tsx",
        "codificacion-codificar",
      ),
      integer: terminalReadinessCount(
        "features/codificacion/IntegerCodificador.tsx",
        "codificacion-codificar",
      ),
      matrices: terminalReadinessCount(
        "features/codificacion/CodingConfigActions.tsx",
        "codificacion-matrices",
      ),
      adaptar: terminalReadinessCount(
        "features/codificacion/AdaptarPane.tsx",
        "codificacion-adaptar",
      ),
      explorar: terminalReadinessCount(
        "features/validacion/tabs/ExplorarTab.tsx",
        "validacion-explorar",
      ),
      instrumento: terminalReadinessCount(
        "features/validacion/tabs/InstrumentoTab.tsx",
        "validacion-instrumento",
      ),
      reglasCustom: terminalReadinessCount(
        "features/validacion/tabs/ReglasCustomTab.tsx",
        "validacion-reglas_custom",
      ),
      limpieza: terminalReadinessCount(
        "features/validacion/tabs/LimpiezaTab.tsx",
        "validacion-limpieza",
      ),
    }, "Terminal marker counts reject duplicates in loading/error branches").toEqual({
      preguntas: 1,
      wizard: 2,
      respuestas: 1,
      integer: 1,
      matrices: 1,
      adaptar: 1,
      explorar: 2,
      instrumento: 1,
      reglasCustom: 1,
      limpieza: 1,
    });
  });

  test("Codificación and Validación remount active panels when their scope changes", () => {
    expect({
      codificacion: hasDirectKeyScope(
        "features/codificacion/CodificacionPage.tsx",
        ["step", "codifActive"],
      ),
      validacion: hasDirectKeyScope(
        "features/validacion/ValidacionPage.tsx",
        ["activeTab", "baseNombre", "version"],
      ),
    }, "Active panel keys must invalidate stale readiness across route/base/version changes").toEqual({
      codificacion: true,
      validacion: true,
    });
  });

  test("Codificación invalidates terminal content while the active base is loading", () => {
    const source = fs.readFileSync(
      path.join(srcDir, "features/codificacion/CodificacionPage.tsx"),
      "utf8",
    );
    const hidesTerminalContent = /\{\s*!codifSource\.loading\s*&&\s*\(\s*<div[\s\S]*?className="pulso-codificacion-panel-body"/.test(
      source,
    );
    const remountsForLoading = hasDirectKeyScope(
      "features/codificacion/CodificacionPage.tsx",
      ["step", "codifActive", "loading"],
    );

    expect(
      hidesTerminalContent || remountsForLoading,
      `Changing base must unmount terminal markers while codifSource.loading; observed ${JSON.stringify({
        hidesTerminalContent,
        remountsForLoading,
      })}`,
    ).toBe(true);
  });

  test("Bitácora publishes an exact semantic key for each guarded tab", () => {
    const { tag } = defaultPageRoot("features/bitacora/BitacoraPage.tsx", "PageFrame");
    const value = readinessValue(tag, "auditReady", "Bitácora");

    expect(bitacoraKeys(), "Bitácora audit tab keys").toEqual([
      "bitacora",
      "cronograma",
      "calendario",
    ]);
    expect(hasBitacoraTabKey(value), "Bitácora readiness must be `bitacora-${tab}`").toBe(true);
    expectNegatedGuard(value, "Bitácora", "loading");
    expectNegatedGuard(value, "Bitácora", "error");
    expectSemanticReadiness(value, "Bitácora", "bitacora-");
    expect(compactExpression(value), "Bitácora guard polarity and fallback").toBe(
      "!loading&&!error?`bitacora-${tab}`:false",
    );
  });

  test("Recopiladores marks only its rec-page root after either data source loads", () => {
    const { tag } = defaultPageRoot(
      "features/recopiladores/RecopiladoresPage.tsx",
      "div",
    );
    expect(literalClassNames(tag), "Recopiladores audit marker must live on div.rec-page").toContain(
      "rec-page",
    );

    const value = readinessValue(tag, "data-audit-ready", "Recopiladores");
    expectSemanticReadiness(value, "Recopiladores", "recopiladores");
    expectNegatedGuard(value, "Recopiladores", "loading");
    expect(
      hasStateFallback(value),
      "Recopiladores readiness must accept state or calcState after loading",
    ).toBe(true);
    expect(compactExpression(value), "Recopiladores exact conjunction, fallback, and polarity").toBe(
      '!loading&&(state!==null||calcState!==null)?"recopiladores":undefined',
    );
  });

  test("Enciclopedia waits for all four catalog loads", () => {
    const { tag } = defaultPageRoot("features/enciclopedia/EnciclopediaHome.tsx", "PageFrame");
    const value = readinessValue(tag, "auditReady", "Enciclopedia");

    expectSemanticReadiness(value, "Enciclopedia", "enciclopedia");
    for (const load of ["catalogo", "glosario", "tabla", "tipos"]) {
      expect(references(value, load), `Enciclopedia readiness must wait for ${load}`).toBe(true);
    }
    expect(compactExpression(value), "Enciclopedia requires all four non-null loads").toBe(
      'catalogo!==null&&glosario!==null&&tabla!==null&&tipos!==null?"enciclopedia":false',
    );
  });
});
