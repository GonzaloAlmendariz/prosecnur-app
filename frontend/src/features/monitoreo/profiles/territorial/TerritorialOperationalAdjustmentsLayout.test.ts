import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const territorialDir = path.dirname(fileURLToPath(import.meta.url));
const styleSources = [
  fs.readFileSync(path.join(territorialDir, "..", "..", "monitoreo.css"), "utf8"),
  fs.readFileSync(path.join(territorialDir, "territorialProfile.css"), "utf8"),
];
const reviewWorkbenchSource = fs.readFileSync(
  path.join(territorialDir, "TerritorialReviewCasesWorkbench.tsx"),
  "utf8",
);

type CssRule = {
  selector: string;
  body: string;
};

function leafRules(sources = styleSources): CssRule[] {
  return sources.flatMap((source) =>
    Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g)).flatMap((match) => {
      const body = match[2] ?? "";

      return (match[1] ?? "")
        .split(",")
        .map((selector) => ({ selector: selector.trim(), body }));
    }),
  );
}

function propertyValues(body: string, property: string): string[] {
  const declaration = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "g");
  return Array.from(body.matchAll(declaration), (match) => (match[1] ?? "").trim());
}

function targetCompound(selector: string): string {
  return selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean).at(-1) ?? "";
}

function targets(selector: string, className: string): boolean {
  return targetCompound(selector).includes(className);
}

function isOperationalScoped(selector: string): boolean {
  return selector.includes(":has(.mon-operational-adjustments)");
}

function bodiesFor(rules: CssRule[], className: string): string {
  return rules
    .filter(({ selector }) => isOperationalScoped(selector) && targets(selector, className))
    .map(({ body }) => body)
    .join("\n");
}

function atRuleBlocks(source: string, header: RegExp): string[] {
  const blocks: string[] = [];

  for (const match of source.matchAll(header)) {
    const openingBrace = (match.index ?? 0) + match[0].lastIndexOf("{");
    let depth = 0;

    for (let cursor = openingBrace; cursor < source.length; cursor += 1) {
      if (source[cursor] === "{") depth += 1;
      if (source[cursor] === "}") depth -= 1;
      if (depth === 0) {
        blocks.push(source.slice(openingBrace + 1, cursor));
        break;
      }
    }
  }

  return blocks;
}

describe("Consultas territoriales: layout de Subsanaciones", () => {
  test("la rama operacional usa el alto del workbench sin heredar las filas vacías de la tabla", () => {
    const rules = leafRules();
    const stageBody = bodiesFor(rules, ".mon-stage--consultas");
    const panelBody = bodiesFor(rules, ".mon-territorial-review-panel");
    const workspaceBody = bodiesFor(rules, ".mon-operational-adjustments");
    const scopedSelectors = rules
      .filter(({ selector }) => isOperationalScoped(selector))
      .map(({ selector }) => selector);
    const panelRows = propertyValues(panelBody, "grid-template-rows");
    const forbiddenHeights = [stageBody, panelBody, workspaceBody]
      .flatMap((body) => [
        ...propertyValues(body, "height"),
        ...propertyValues(body, "min-height"),
      ])
      .filter((value) => /100dvh|max-content/.test(value));

    expect({
      hasOperationalBranch: scopedSelectors.length > 0,
      stageUsesParentHeight: propertyValues(stageBody, "height").includes("100%"),
      panelUsesParentHeight: propertyValues(panelBody, "height").includes("100%"),
      workspaceUsesParentHeight: propertyValues(workspaceBody, "height").includes("100%"),
      panelHasOneUsefulTrack:
        panelRows.length > 0
        && panelRows.every((value) => /^minmax\((?:0|auto),\s*1fr\)$/.test(value)),
      avoidsViewportOrIntrinsicHeight: forbiddenHeights.length === 0,
    }).toEqual({
      hasOperationalBranch: true,
      stageUsesParentHeight: true,
      panelUsesParentHeight: true,
      workspaceUsesParentHeight: true,
      panelHasOneUsefulTrack: true,
      avoidsViewportOrIntrinsicHeight: true,
    });
  });

  test("las listas y tarjetas conservan su alto intrínseco y un mínimo legible", () => {
    const rules = leafRules();
    const listBody = bodiesFor(rules, ".mon-operational-adjustments__list");
    const suggestionBody = bodiesFor(rules, ".mon-operational-suggestion");
    const suggestionHeights = propertyValues(suggestionBody, "height");

    expect({
      listRowsFollowContent: propertyValues(listBody, "grid-auto-rows").includes("max-content"),
      cardUsesIntrinsicHeight:
        suggestionHeights.includes("max-content") || suggestionHeights.includes("auto"),
      cardKeepsUsefulMinimum: propertyValues(suggestionBody, "min-height").includes("118px"),
      cardDoesNotClipVertically:
        !propertyValues(suggestionBody, "overflow").includes("hidden")
        && !propertyValues(suggestionBody, "overflow-y").includes("hidden"),
    }).toEqual({
      listRowsFollowContent: true,
      cardUsesIntrinsicHeight: true,
      cardKeepsUsefulMinimum: true,
      cardDoesNotClipVertically: true,
    });
  });

  test("mantiene separada la tabla y ofrece un fallback alcanzable en ventanas bajas", () => {
    const rules = leafRules();
    const tableSelectors = rules
      .filter(({ selector }) => selector.includes(":has(.mon-territorial-review-table-shell)"))
      .map(({ selector }) => selector);
    const operationalSelectors = rules
      .filter(({ selector }) => isOperationalScoped(selector))
      .map(({ selector }) => selector);
    const compactBlocks = styleSources.flatMap((source) =>
      atRuleBlocks(source, /@media\s*\([^{}]*max-height[^{}]*\)\s*\{/g),
    );
    const compactRules = leafRules(compactBlocks).filter(({ selector }) => isOperationalScoped(selector));
    const compactOwnerBody = compactRules
      .filter(({ selector }) => targets(selector, ".mon-workbench-content--consultas"))
      .map(({ body }) => body)
      .join("\n");
    const compactLayoutBody = compactRules
      .filter(({ selector }) => [
        ".mon-stage--consultas",
        ".mon-territorial-review-panel",
        ".mon-operational-adjustments",
      ].some((className) => targets(selector, className)))
      .map(({ body }) => body)
      .join("\n");
    const compactOverflow = [
      ...propertyValues(compactLayoutBody, "overflow"),
      ...propertyValues(compactLayoutBody, "overflow-y"),
    ];

    expect({
      tableBranchStillExists: tableSelectors.length > 0,
      branchesDoNotOverlap:
        tableSelectors.every((selector) => !selector.includes(".mon-operational-adjustments"))
        && operationalSelectors.every((selector) => !selector.includes(".mon-territorial-review-table-shell")),
      compactOperationalBranchExists: compactRules.length > 0,
      compactOwnerCanScroll: propertyValues(compactOwnerBody, "overflow-y").includes("auto"),
      compactContentRemainsReachable:
        compactOverflow.some((value) => value === "visible" || value === "auto")
        && !compactOverflow.includes("hidden"),
    }).toEqual({
      tableBranchStillExists: true,
      branchesDoNotOverlap: true,
      compactOperationalBranchExists: true,
      compactOwnerCanScroll: true,
      compactContentRemainsReachable: true,
    });
  });

  test("al entrar en Subsanaciones reinicia el scroll del contenedor de Consultas", () => {
    const effects = Array.from(
      reviewWorkbenchSource.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\},\s*\[([^\]]*)\]\);/g),
      (match) => ({ body: match[1] ?? "", dependencies: match[2] ?? "" }),
    );
    const scrollResetEffect = effects.find(({ body, dependencies }) =>
      dependencies.includes("showingOperationalAdjustments")
      && body.includes(".mon-workbench-content--consultas"),
    );
    const resetsToTop = scrollResetEffect
      ? /scrollTop\s*=\s*0/.test(scrollResetEffect.body)
        || /scrollTo\([\s\S]*?top\s*:\s*0/.test(scrollResetEffect.body)
      : false;

    expect({
      watchesOperationalEntry: Boolean(scrollResetEffect),
      resetsConsultasOwnerToTop: resetsToTop,
    }).toEqual({
      watchesOperationalEntry: true,
      resetsConsultasOwnerToTop: true,
    });
  });

  test("en anchos compactos apila cada sugerencia y sus chips en una sola columna", () => {
    const compactWidthBlocks = styleSources.flatMap((source) =>
      atRuleBlocks(source, /@media\s*\([^{}]*max-width[^{}]*\)\s*\{/g),
    );
    const compactRules = leafRules(compactWidthBlocks).filter(({ selector }) =>
      isOperationalScoped(selector),
    );
    const suggestionBody = bodiesFor(compactRules, ".mon-operational-suggestion");
    const chipsBody = bodiesFor(compactRules, ".mon-operational-suggestion__chips");
    const suggestionColumns = propertyValues(suggestionBody, "grid-template-columns");
    const chipsColumns = propertyValues(chipsBody, "grid-column");

    expect({
      compactOperationalBranchExists: compactRules.length > 0,
      suggestionUsesOneColumn: suggestionColumns.some((value) =>
        value === "1fr" || value === "minmax(0, 1fr)"
      ),
      chipsStayInSuggestionColumn: chipsColumns.some((value) =>
        value === "1" || value === "1 / -1"
      ),
    }).toEqual({
      compactOperationalBranchExists: true,
      suggestionUsesOneColumn: true,
      chipsStayInSuggestionColumn: true,
    });
  });
});
