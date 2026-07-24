import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type JsxTag = ts.JsxOpeningLikeElement;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(entryPath);
    }
    if (!entry.name.endsWith(".tsx") || /\.(?:test|spec)\.tsx$/.test(entry.name)) return [];
    return [entryPath];
  });
}

function attribute(tag: JsxTag, name: string): ts.JsxAttribute | undefined {
  return tag.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function literalAttributeValue(tag: JsxTag, name: string): string | null {
  const attr = attribute(tag, name);
  if (!attr?.initializer) return null;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text.trim();
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    const expression = attr.initializer.expression;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text.trim();
    }
  }
  return null;
}

function hasNonEmptyAttribute(tag: JsxTag, name: string): boolean {
  const attr = attribute(tag, name);
  if (!attr?.initializer) return false;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text.trim().length > 0;
  return ts.isJsxExpression(attr.initializer) && attr.initializer.expression != null;
}

function lineLabel(file: string, sourceFile: ts.SourceFile, node: ts.Node): string {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return `${path.relative(srcDir, file)}:${line}`;
}

function jsxTags(sourceFile: ts.SourceFile): JsxTag[] {
  const tags: JsxTag[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) tags.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return tags;
}

describe("GlidingTabList navigation contract", () => {
  const files = sourceFiles(srcDir);

  test("keeps the 180ms global motion curve and reduced-motion fallback exact", () => {
    const theme = fs.readFileSync(path.join(srcDir, "app", "theme.css"), "utf8");

    expect(theme).toMatch(/transform 180ms cubic-bezier\(\.2, \.8, \.2, 1\)/);
    expect(theme).toMatch(/width 180ms cubic-bezier\(\.2, \.8, \.2, 1\)/);
    expect(theme).toMatch(/height 180ms cubic-bezier\(\.2, \.8, \.2, 1\)/);
    expect(theme).toMatch(/border-radius 180ms cubic-bezier\(\.2, \.8, \.2, 1\)/);
    expect(theme).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.pulso-gliding-tab-indicator\.is-motion-ready[\s\S]*?transition: none/,
    );
  });

  test("keeps every runtime remeasurement trigger wired", () => {
    const component = fs.readFileSync(path.join(srcDir, "components", "GlidingTabList.tsx"), "utf8");

    expect(component).toContain("new ResizeObserver(scheduleMeasure)");
    expect(component).toContain("new MutationObserver");
    expect(component).toContain('window.addEventListener("resize", scheduleMeasure)');
    expect(component).toContain("[activeKey, itemSelector]");
    expect(component).toMatch(
      /enableMotionFrame = window\.requestAnimationFrame\(\(\) => \{[\s\S]*?setCanAnimate\(true\);[\s\S]*?\}\);/,
    );
  });

  test("measures synchronously on mount before scheduling animated remeasurement", () => {
    const component = fs.readFileSync(path.join(srcDir, "components", "GlidingTabList.tsx"), "utf8");
    const initialWiring = component.slice(
      component.indexOf('window.addEventListener("resize", scheduleMeasure)'),
      component.indexOf("return () =>", component.indexOf('window.addEventListener("resize", scheduleMeasure)')),
    );

    expect(initialWiring).toMatch(
      /window\.addEventListener\("resize", scheduleMeasure\);\s*measure\(\);/,
    );
  });

  test("derives the indicator silhouette from the active item's computed radius", () => {
    const component = fs.readFileSync(path.join(srcDir, "components", "GlidingTabList.tsx"), "utf8");

    expect(component).toMatch(/(?:window\.)?getComputedStyle\(activeItem\)/);
    expect(component).toMatch(/borderRadius/);
  });

  test("inherits the active MODULE_TONES chrome on the main application surface", () => {
    const layout = fs.readFileSync(path.join(srcDir, "app", "Layout.tsx"), "utf8");

    expect(layout).toMatch(
      /const\s+activeModule\s*=\s*PROSECNUR_PRIMARY_ACTIVE_MODULES\s*\.find\(/,
    );
    expect(layout).toMatch(
      /<main[\s\S]*?style=\{activeModule\s*\?\s*moduleChromeVars\(activeModule\)\s*:\s*undefined\}/,
    );
  });

  test("Processing uses link navigation semantics with opt-in roving focus", () => {
    const layout = fs.readFileSync(path.join(srcDir, "app", "Layout.tsx"), "utf8");
    const dock = layout.slice(
      layout.indexOf("function ProcessingPhaseDock("),
      layout.indexOf("function SessionErrorChip("),
    );

    expect(dock).toMatch(/<GlidingTabList[\s\S]*?mode="nav"/);
    expect(dock).not.toMatch(/role="tablist"/);
    expect(dock).not.toMatch(/role="tab"/);
    expect(dock).not.toMatch(/aria-selected=/);
    expect(dock).toMatch(/aria-current=\{active\s*\?\s*"page"\s*:\s*undefined\}/);
  });

  test("the module switcher keeps links inside a semantic navigation list", () => {
    const layout = fs.readFileSync(path.join(srcDir, "app", "Layout.tsx"), "utf8");
    const switcher = layout.slice(
      layout.indexOf("function ModuleSwitcher("),
      layout.indexOf("function siblingSourceTitle("),
    );

    expect(switcher).toMatch(/<nav[\s\S]*?<ul[^>]*className="pulso-module-dock"[\s\S]*?<li[\s\S]*?<NavLink/);
    expect(switcher).not.toMatch(/<NavLink[\s\S]*?role="listitem"/);
    expect(switcher).toMatch(/aria-current=\{isCurrent\s*\?\s*"page"\s*:\s*undefined\}/);
  });

  test("every literal tablist uses the shared indicator or a justified opt-out", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const sourceFile = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      for (const tag of jsxTags(sourceFile)) {
        if (literalAttributeValue(tag, "role") !== "tablist") continue;
        const tagName = tag.tagName.getText(sourceFile);
        const optedOut = (literalAttributeValue(tag, "data-gliding-opt-out") ?? "").length > 0;
        if (tagName !== "GlidingTabList" && !optedOut) {
          offenders.push(`${lineLabel(file, sourceFile, tag)} <${tagName}>`);
        }
      }
    }

    expect(offenders, "Tablists without GlidingTabList or a non-empty data-gliding-opt-out").toEqual([]);
  });

  test("tab roles in migrated files publish a measurable gliding key", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const sourceFile = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const tags = jsxTags(sourceFile);
      const hasMigratedTablist = tags.some(
        (tag) => literalAttributeValue(tag, "role") === "tablist" && tag.tagName.getText(sourceFile) === "GlidingTabList",
      );
      if (!hasMigratedTablist) continue;

      for (const tag of tags) {
        if (literalAttributeValue(tag, "role") !== "tab") continue;
        const optedOut = (literalAttributeValue(tag, "data-gliding-opt-out") ?? "").length > 0;
        if (!hasNonEmptyAttribute(tag, "data-gliding-key") && !optedOut) {
          offenders.push(`${lineLabel(file, sourceFile, tag)} <${tag.tagName.getText(sourceFile)}>`);
        }
      }
    }

    expect(offenders, "Tabs without data-gliding-key or a non-empty data-gliding-opt-out").toEqual([]);
  });
});
