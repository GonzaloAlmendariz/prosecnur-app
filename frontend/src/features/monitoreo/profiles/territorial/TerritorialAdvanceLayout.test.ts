import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const territorialDir = path.dirname(fileURLToPath(import.meta.url));
const advanceSource = fs.readFileSync(path.join(territorialDir, "TerritorialAdvanceWorkbench.tsx"), "utf8");
const styleSources = [
  fs.readFileSync(path.join(territorialDir, "..", "..", "monitoreo.css"), "utf8"),
  fs.readFileSync(path.join(territorialDir, "territorialProfile.css"), "utf8"),
];

type CssRule = { selector: string; body: string };

function leafRules(sources = styleSources): CssRule[] {
  return sources.flatMap((source) =>
    Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g)).flatMap((match) =>
      (match[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "").split(",").map((selector) => ({
        selector: selector.trim(),
        body: match[2] ?? "",
      })),
    ),
  );
}

function propertyValues(body: string, property: string): string[] {
  const declaration = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "g");
  return Array.from(body.matchAll(declaration), (match) => (match[1] ?? "").trim());
}

function bodiesFor(selector: string, rules = leafRules()): string {
  return rules.filter((rule) => rule.selector === selector).map((rule) => rule.body).join("\n");
}

function bodiesTargeting(className: string, rules = leafRules()): string {
  return rules
    .filter(({ selector }) => (selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean).at(-1) ?? "").includes(className))
    .map(({ body }) => body)
    .join("\n");
}

function effectiveProperty(body: string, property: string): string {
  return propertyValues(body, property).at(-1) ?? "";
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

describe("Avance territorial: contrato de layout", () => {
  test("Resumen distribuye cuatro paneles útiles sin estirar un lateral vacío", () => {
    const canvasBody = bodiesFor(".mon-territorial-exec-canvas.is-resumen");
    const sideBody = bodiesFor(".mon-territorial-exec-side");
    const prioritiesBody = bodiesFor(".mon-territorial-exec-priorities");
    const areas = propertyValues(canvasBody, "grid-template-areas").join(" ").replace(/\s+/g, " ");
    const sideIsTransparent = propertyValues(sideBody, "display").includes("contents")
      || !advanceSource.includes('className="mon-territorial-exec-side"');

    expect({
      sideParticipatesInParentGrid: sideIsTransparent,
      topRowIsProgressAndPriorities: areas.includes('"progress priorities"'),
      bottomRowIsUmpAndCut: areas.includes('"ump cut"'),
      prioritiesDoNotStretchContent: propertyValues(prioritiesBody, "align-content").includes("start"),
    }).toEqual({
      sideParticipatesInParentGrid: true,
      topRowIsProgressAndPriorities: true,
      bottomRowIsUmpAndCut: true,
      prioritiesDoNotStretchContent: true,
    });
  });

  test("los grupos de prioridades no igualan el alto del estado vacío al grupo con datos", () => {
    const rules = leafRules();
    const groupsBody = bodiesFor(".mon-territorial-exec-priority-groups", rules);
    const emptyDistrictBody = rules
      .filter(({ selector }) =>
        selector.includes(".mon-territorial-exec-priority-groups")
        && (selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean).at(-1) ?? "").includes(".is-districts"),
      )
      .map(({ body }) => body)
      .join("\n");

    expect({
      groupsAlignIntrinsicCards: effectiveProperty(groupsBody, "align-items") === "start",
      emptyDistrictAlignsToStart: effectiveProperty(emptyDistrictBody, "align-self") === "start",
      emptyDistrictKeepsIntrinsicHeight: effectiveProperty(emptyDistrictBody, "height") === "auto",
    }).toEqual({
      groupsAlignIntrinsicCards: true,
      emptyDistrictAlignsToStart: true,
      emptyDistrictKeepsIntrinsicHeight: true,
    });
  });

  test("Mapa y UMP conserva una sola lista, un inspector y relega la tabla a disclosure", () => {
    const navigatorCount = (advanceSource.match(/<TerritorialUmpMapNavigator\b/g) ?? []).length;
    const inspectorCount = (advanceSource.match(/className="mon-territorial-ump-detail"/g) ?? []).length;
    const hasSecondaryTableDisclosure = /<details\b[\s\S]*?<summary\b[\s\S]*?className="mon-territorial-ump-table-wrap"[\s\S]*?<\/details>/.test(advanceSource);

    expect({
      oneMasterList: navigatorCount === 1,
      oneInspector: inspectorCount === 1,
      duplicatedNavigatorInspectorRemoved: !advanceSource.includes("mon-territorial-ump-map-nav-focus"),
      secondaryTableUsesDisclosure: hasSecondaryTableDisclosure,
    }).toEqual({
      oneMasterList: true,
      oneInspector: true,
      duplicatedNavigatorInspectorRemoved: true,
      secondaryTableUsesDisclosure: true,
    });
  });

  test("Mapa y UMP usa tres columnas amplias, fallback compacto y una altura mínima coherente", () => {
    const layoutBody = bodiesFor(".mon-territorial-ump-map-layout");
    const broadColumns = propertyValues(layoutBody, "grid-template-columns");
    const compactBlocks = styleSources.flatMap((source) =>
      atRuleBlocks(source, /@media\s*\([^{}]*max-width[^{}]*\)\s*\{/g),
    );
    const compactColumns = propertyValues(bodiesFor(".mon-territorial-ump-map-layout", leafRules(compactBlocks)), "grid-template-columns");
    const hasUsefulMapMinimum = styleSources.some((source) =>
      /\.mon-territorial-ump-map-(?:layout|pane)[^{]*\{[^}]*(?:min-height|grid-template-rows|--mon-territorial-map-height)\s*:\s*(?:clamp\()?3[2-9]\dpx/.test(source),
    );
    const umpLayoutRules = leafRules().filter(({ selector }) =>
      selector.includes(".mon-territorial-ump-map-layout") || selector.includes(".mon-territorial-ump-map-pane"),
    );

    expect({
      broadWorkspaceHasThreeColumns: broadColumns.some((value) => (value.match(/minmax\(/g) ?? []).length >= 3),
      compactWorkspaceStacks: compactColumns.includes("1fr"),
      mapKeepsAtLeast320Pixels: hasUsefulMapMinimum,
      avoidsContradictoryRouteHeight: umpLayoutRules.every(({ body }) => !body.includes("--route-main-height")),
    }).toEqual({
      broadWorkspaceHasThreeColumns: true,
      compactWorkspaceStacks: true,
      mapKeepsAtLeast320Pixels: true,
      avoidsContradictoryRouteHeight: true,
    });
  });

  test("Mapa y UMP gobierna una fila amplia y vuelve al flujo intrínseco en compacto", () => {
    const rules = leafRules();
    const layoutBody = bodiesFor(".mon-territorial-ump-map-layout", rules);
    const mapPaneBody = bodiesFor(".mon-territorial-ump-map-pane", rules);
    const navListBody = bodiesFor(".mon-territorial-ump-map-nav > div", rules);
    const detailBody = bodiesFor(".mon-territorial-ump-detail", rules);
    const cardBody = bodiesTargeting(".mon-territorial-advance-map-card", rules);
    const viewportBody = bodiesTargeting(".mon-territorial-advance-map-viewport", rules);
    const compactBlocks = styleSources.flatMap((source) =>
      atRuleBlocks(source, /@media\s*\([^{}]*max-width[^{}]*\)\s*\{/g),
    );
    const compactRules = leafRules(compactBlocks);
    const compactLayoutBody = bodiesFor(".mon-territorial-ump-map-layout", compactRules);
    const compactCardBody = bodiesTargeting(".mon-territorial-advance-map-card", compactRules);
    const compactViewportBody = bodiesTargeting(".mon-territorial-advance-map-viewport", compactRules);
    const compactOwnerBody = bodiesFor(".mon-workbench-content--avance", compactRules);
    const wideHeights = propertyValues(layoutBody, "height");
    const wideMaximums = propertyValues(layoutBody, "max-height");
    const wideRows = propertyValues(layoutBody, "grid-template-rows");
    const wideColumns = propertyValues(layoutBody, "grid-template-columns");
    const cardRows = propertyValues(cardBody, "grid-template-rows");
    const viewportMinimums = propertyValues(viewportBody, "min-height");
    const compactViewportMinimums = propertyValues(compactViewportBody, "min-height");

    expect({
      wideLayoutHasBoundedHeight:
        wideHeights.some((value) => value.includes("clamp("))
        || wideMaximums.some((value) => /clamp\(|\d+px/.test(value)),
      wideRowCannotInflateFromList:
        wideRows.some((value) => value.includes("minmax(0, 1fr)") || value.includes("clamp(")),
      wideWorkspaceHasThreeColumns:
        wideColumns.some((value) => (value.match(/minmax\(/g) ?? []).length >= 3),
      navigatorOwnsItsScroll:
        propertyValues(navListBody, "min-height").includes("0")
        && propertyValues(navListBody, "overflow").includes("auto"),
      detailOwnsItsScroll:
        propertyValues(detailBody, "min-height").includes("0")
        && propertyValues(detailBody, "overflow").includes("auto"),
      mapPaneKeepsOnlyViewportFlexible:
        propertyValues(mapPaneBody, "grid-template-rows").includes("auto minmax(0, 1fr)"),
      wideCardFillsGovernedRow: propertyValues(cardBody, "height").includes("100%"),
      wideCardProtectsFlexibleViewport:
        cardRows.some((value) => /^auto\s+minmax\(320px,\s*1fr\)\s+auto$/.test(value)),
      wideViewportKeepsUsefulMinimum:
        viewportMinimums.some((value) => value.endsWith("px") && Number.parseFloat(value) >= 320),
      compactLayoutReturnsToIntrinsicFlow:
        propertyValues(compactLayoutBody, "height").includes("auto")
        && propertyValues(compactLayoutBody, "grid-template-rows").includes("auto"),
      compactCardReturnsToIntrinsicFlow:
        propertyValues(compactCardBody, "height").includes("auto")
        && propertyValues(compactCardBody, "grid-template-rows").some((value) =>
          /^auto\s+minmax\(320px,\s*auto\)\s+auto$/.test(value)
        ),
      compactViewportKeepsUsefulMinimum:
        compactViewportMinimums.some((value) => value.endsWith("px") && Number.parseFloat(value) >= 320),
      compactExteriorOwnsFallbackScroll:
        propertyValues(compactOwnerBody, "overflow-y").includes("auto"),
    }).toEqual({
      wideLayoutHasBoundedHeight: true,
      wideRowCannotInflateFromList: true,
      wideWorkspaceHasThreeColumns: true,
      navigatorOwnsItsScroll: true,
      detailOwnsItsScroll: true,
      mapPaneKeepsOnlyViewportFlexible: true,
      wideCardFillsGovernedRow: true,
      wideCardProtectsFlexibleViewport: true,
      wideViewportKeepsUsefulMinimum: true,
      compactLayoutReturnsToIntrinsicFlow: true,
      compactCardReturnsToIntrinsicFlow: true,
      compactViewportKeepsUsefulMinimum: true,
      compactExteriorOwnsFallbackScroll: true,
    });
  });

  test("Mapa y UMP da una fila completa a la búsqueda en el régimen apilado", () => {
    const stackedBlocks = styleSources.flatMap((source) =>
      atRuleBlocks(source, /@media\s*\(max-width:\s*1180px\)\s*\{/g),
    );
    const searchBody = bodiesFor(
      ".mon-territorial-ump-toolbar .mon-query-search",
      leafRules(stackedBlocks),
    );
    const toolbarBody = bodiesFor(
      ".mon-territorial-ump-toolbar",
      leafRules(stackedBlocks),
    );
    const selectBody = bodiesFor(
      ".mon-territorial-ump-toolbar .mon-territorial-ump-select",
      leafRules(stackedBlocks),
    );
    const lastPairBody = bodiesFor(
      ".mon-territorial-ump-toolbar .mon-territorial-ump-select:nth-last-child(-n+2)",
      leafRules(stackedBlocks),
    );

    expect(advanceSource).toContain(
      'placeholder="Buscar UMP, manzana, distrito o responsable..."',
    );
    expect(propertyValues(searchBody, "grid-column")).toContain("1 / -1");
    expect(propertyValues(toolbarBody, "grid-template-columns")).toContain(
      "repeat(6, minmax(0, 1fr))",
    );
    expect(propertyValues(selectBody, "grid-column")).toContain("span 2");
    expect(propertyValues(lastPairBody, "grid-column")).toContain("span 3");
  });

  test("Ritmo no fija Plotly a 360px y adapta alto y anchura compactos", () => {
    const chartSelector = ".mon-territorial-tab-panel--rhythm .mon-territorial-rhythm-chart .dash-plotly-chart";
    const chartBody = bodiesFor(chartSelector);
    const rigidHeight = propertyValues(chartBody, "height").some((value) => /360px\s*!important/.test(value));
    const compactHeightBlocks = styleSources.flatMap((source) =>
      atRuleBlocks(source, /@media\s*\([^{}]*max-height[^{}]*\)\s*\{/g),
    );
    const compactWidthBlocks = styleSources.flatMap((source) =>
      atRuleBlocks(source, /@media\s*\([^{}]*max-width[^{}]*\)\s*\{/g),
    );
    const compactHeightBody = bodiesFor(chartSelector, leafRules(compactHeightBlocks));
    const compactWidthBody = bodiesFor(".mon-territorial-rhythm-layout", leafRules(compactWidthBlocks));

    expect({
      noRigidPlotHeight: !rigidHeight,
      compactHeightFallback: propertyValues(compactHeightBody, "height").some((value) => /clamp\(|auto|min\(/.test(value)),
      compactWidthFallback: propertyValues(compactWidthBody, "grid-template-columns").includes("1fr"),
    }).toEqual({
      noRigidPlotHeight: true,
      compactHeightFallback: true,
      compactWidthFallback: true,
    });
  });
});
