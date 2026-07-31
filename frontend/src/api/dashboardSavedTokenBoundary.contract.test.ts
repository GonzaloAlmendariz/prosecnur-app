import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const apiDir = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(apiDir, "..");
const repoRoot = path.resolve(srcRoot, "../..");

function readRepo(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function parseTypes(relativePath: string): ts.SourceFile {
  const source = readRepo(relativePath);
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function namedTypeMembers(
  sourceFile: ts.SourceFile,
  name: string,
): readonly ts.TypeElement[] {
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      if (ts.isTypeLiteralNode(statement.type)) return statement.type.members;
    }
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return statement.members;
    }
  }
  throw new Error(`No se encontró el tipo ${name} en ${sourceFile.fileName}`);
}

function propertyName(member: ts.TypeElement): string | null {
  if (!member.name) return null;
  if (
    ts.isIdentifier(member.name) ||
    ts.isStringLiteral(member.name) ||
    ts.isNumericLiteral(member.name)
  ) {
    return member.name.text;
  }
  return member.name.getText();
}

function resolveTypeMembers(
  sourceFile: ts.SourceFile,
  node: ts.TypeNode,
): readonly ts.TypeElement[] {
  if (ts.isTypeLiteralNode(node)) return node.members;
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    return namedTypeMembers(sourceFile, node.typeName.text);
  }
  throw new Error(`El payload del broker debe ser un objeto tipado: ${node.getText(sourceFile)}`);
}

function productionTypeScriptFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (
        entry.isFile() &&
        /\.(?:ts|tsx)$/.test(entry.name) &&
        !/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)
      ) {
        files.push(full);
      }
    }
  };
  visit(root);
  return files.sort();
}

function visit(node: ts.Node, callback: (candidate: ts.Node) => void): void {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

describe("frontera de tokens HF guardados", () => {
  test("el preload elimina getHfToken y expone solo la ruta del broker", () => {
    const preload = readRepo("desktop/preload.cjs");

    expect(preload).not.toMatch(/\bgetHfToken\b/);
    expect(preload).not.toContain('"hf:getToken"');
    expect(preload).toMatch(/\bpublishDashboardWithSavedToken\s*:/);
    expect(preload).toMatch(
      /ipcRenderer\.invoke\(\s*["']hf:publishDashboard["']/,
    );
  });

  test("el bridge tipado acepta IDs y metadata, nunca plaintext", () => {
    const sourceFile = parseTypes("frontend/src/features/project/types.ts");
    const bridgeMembers = namedTypeMembers(sourceFile, "ProsecnurApi");
    const bridgeNames = bridgeMembers.map(propertyName);

    expect(bridgeNames).not.toContain("getHfToken");
    expect(bridgeNames).toContain("publishDashboardWithSavedToken");

    const brokerMember = bridgeMembers.find(
      (member) => propertyName(member) === "publishDashboardWithSavedToken",
    );
    expect(brokerMember).toBeDefined();

    let parameter: ts.ParameterDeclaration | undefined;
    if (
      brokerMember &&
      ts.isPropertySignature(brokerMember) &&
      brokerMember.type &&
      ts.isFunctionTypeNode(brokerMember.type)
    ) {
      parameter = brokerMember.type.parameters[0];
    } else if (brokerMember && ts.isMethodSignature(brokerMember)) {
      parameter = brokerMember.parameters[0];
    }
    expect(parameter?.type, "el broker debe tipar su payload").toBeDefined();

    const payloadMembers = resolveTypeMembers(sourceFile, parameter!.type!);
    expect(payloadMembers.map(propertyName).sort()).toEqual([
      "hf_username",
      "private",
      "session_id",
      "space_name",
      "token_id",
    ]);
    expect(brokerMember!.getText(sourceFile)).not.toMatch(/\bhf_token\b/);

    const savedTokenMembers = namedTypeMembers(sourceFile, "HfSavedToken");
    expect(savedTokenMembers.map(propertyName)).not.toContain("hf_token");
  });

  test("ningún consumidor frontend puede volver a pedir el token guardado", () => {
    const offenders = productionTypeScriptFiles(srcRoot)
      .filter((file) => /\bgetHfToken\b/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(repoRoot, file).split(path.sep).join("/"));

    expect(offenders).toEqual([]);
  });

  test("la publicación con token seleccionado usa session_id y token_id del broker", () => {
    const relativePath =
      "frontend/src/features/dashboard/publish/DashboardPublishDialog.tsx";
    const sourceFile = parseTypes(relativePath);
    const brokerCalls: ts.CallExpression[] = [];

    visit(sourceFile, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "publishDashboardWithSavedToken"
      ) {
        brokerCalls.push(node);
      }
    });

    expect(
      brokerCalls.length,
      `${relativePath} debe enviar tokens guardados por el broker Electron`,
    ).toBeGreaterThan(0);

    const payload = brokerCalls[0].arguments[0];
    expect(ts.isObjectLiteralExpression(payload)).toBe(true);
    const properties = (payload as ts.ObjectLiteralExpression).properties
      .filter(ts.isPropertyAssignment);
    const names = properties.map((property) => property.name.getText(sourceFile));

    expect(names).toEqual(
      expect.arrayContaining([
        "session_id",
        "token_id",
        "hf_username",
        "space_name",
      ]),
    );
    expect(names).not.toEqual(
      expect.arrayContaining(["url", "path", "headers", "hf_token"]),
    );

    const tokenId = properties.find(
      (property) => property.name.getText(sourceFile) === "token_id",
    );
    expect(tokenId?.initializer.getText(sourceFile)).toContain("selectedTokenId");

    const source = sourceFile.getFullText();
    expect(source).not.toMatch(/\bresolveHfTokenForPublish\b/);
    expect(source).not.toMatch(/saved\??\.hf_token\b/);
  });
});
