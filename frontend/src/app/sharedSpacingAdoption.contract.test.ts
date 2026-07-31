import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const readCss = (file: string) =>
  fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const boot = readCss(path.join(appDir, "boot.css"));
const theme = readCss(path.join(appDir, "theme.css"));
const chrome = readCss(path.resolve(appDir, "../components/chrome.css"));
const contextRail = readCss(path.resolve(appDir, "../components/ContextTabRail.css"));
const states = readCss(path.resolve(appDir, "../components/states.css"));
const repeatIdentity = readCss(path.resolve(appDir, "../components/repeat-identity.css"));
const toaster = readCss(path.resolve(appDir, "../components/toaster.css"));
const basesInspector = readCss(path.resolve(appDir, "../components/bases-inspector.css"));
const dashboardTokens = readCss(path.resolve(appDir, "../features/dashboard/theme/tokens.css"));

function declarationBlocksFor(source: string, selector: string): string[] {
  const matches = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((match) =>
    match[1]
      .replace(/\s+/g, " ")
      .split(",")
      .map((member) => member.trim())
      .includes(selector),
  );

  expect(matches.length, `No se encontró la regla ${selector}`).toBeGreaterThan(0);
  return matches.map((match) => match[2].replace(/\s+/g, " ").trim());
}

function hasExactDeclaration(block: string, expected: string): boolean {
  const separator = expected.indexOf(":");
  const expectedProperty = expected.slice(0, separator).trim();
  const expectedValue = expected.slice(separator + 1).trim();

  return block.split(";").some((rawDeclaration) => {
    const colon = rawDeclaration.indexOf(":");
    if (colon < 0) return false;
    const property = rawDeclaration.slice(0, colon).trim();
    const value = rawDeclaration.slice(colon + 1).trim().replace(/\s+/g, " ");
    return property === expectedProperty && value === expectedValue;
  });
}

describe("adopción de spacing en el kit compartido", () => {
  test.each([
    ["boot", boot, ".boot-recents-head", "margin-bottom: var(--pulso-space-3)"],
    ["boot", boot, ".boot-footer", "gap: var(--pulso-space-3)"],
    ["boot", boot, ".boot-empty svg", "margin-bottom: var(--pulso-space-1)"],
    ["theme", theme, ".pulso-button--md", "padding-inline: var(--pulso-space-3)"],
    ["theme", theme, ".pulso-button--lg", "padding-inline: var(--pulso-space-4)"],
    ["theme", theme, ".pulso-page-frame", "gap: var(--pulso-space-3)"],
    ["theme", theme, ".pulso-page-frame-header", "gap: var(--pulso-space-4)"],
    ["theme", theme, ".pulso-page-frame-meta", "gap: var(--pulso-space-2)"],
    ["theme", theme, ".pulso-page-frame-notices", "gap: var(--pulso-space-2)"],
    ["theme", theme, ".pulso-page-frame-toolbar", "gap: var(--pulso-space-2)"],
    ["theme", theme, ".pulso-page-frame--compact", "gap: var(--pulso-space-2)"],
    ["theme", theme, ".pulso-panel", "padding: var(--pulso-space-4) 18px"],
    ["theme", theme, ".pulso-panel-header", "gap: var(--pulso-space-3)"],
    ["theme", theme, ".pulso-panel-actions", "gap: var(--pulso-space-2)"],
    ["theme", theme, ".pulso-panel-title", "gap: var(--pulso-space-2)"],
    ["theme", theme, ".pulso-context-bar--compact", "padding: var(--pulso-space-2) var(--pulso-space-3)"],
    ["theme", theme, ".pulso-context-bar-divider", "margin: 0 var(--pulso-space-1)"],
    ["theme", theme, ".pulso-page-frame", "gap: var(--pulso-space-2)"],
    ["theme", theme, ".pulso-context-bar", "gap: var(--pulso-space-2)"],
    ["theme", theme, ".pulso-context-bar", "padding: var(--pulso-space-2) 10px"],
    ["theme", theme, ':root[data-pulso-layout-density="compact"] .pulso-page-frame', "gap: var(--pulso-space-2)"],
    ["theme", theme, ':root[data-pulso-layout-density="compact"] .pulso-context-bar', "gap: var(--pulso-space-2)"],
    ["theme", theme, ':root[data-pulso-layout-density="compact"] .pulso-context-bar', "padding: var(--pulso-space-2) 10px"],
    ["theme", theme, ':root[data-pulso-layout-mode="compact"] .pulso-app-header', "gap: var(--pulso-space-2) 10px"],
    ["theme", theme, ':root[data-pulso-layout-mode="compact"] .pulso-app-header', "padding: var(--pulso-space-2) var(--pulso-space-3)"],
    ["theme", theme, ':root[data-pulso-layout-mode="compact"] .pulso-nav-cluster', "padding: var(--pulso-space-1)"],
    ["theme", theme, ".pulso-sibling-option", "padding: 7px var(--pulso-space-2)"],
    ["theme", theme, ".pulso-sibling-option-dots", "gap: var(--pulso-space-1)"],
    ["theme", theme, ".pulso-phase-pill", "padding: 0 clamp(var(--pulso-space-2), 0.72vw, var(--pill-pad-x))"],
    ["theme", theme, ".pulso-main--processing .pulso-page-frame", "gap: var(--pulso-space-2)"],
    ["chrome", chrome, '.pulso-module-command-bar > .pulso-command-bar-zone[data-zone="contexto"]', "gap: var(--pulso-space-1)"],
    ["chrome", chrome, ".pulso-chrome-indicator", "padding: 0 var(--pulso-space-2)"],
    ["context-rail", contextRail, ".pulso-context-tab-rail--labeled .pulso-context-tab-item", "padding: var(--pulso-space-1) var(--pulso-space-2) var(--pulso-space-1) 2px"],
    ["states", states, ".pulso-empty-state--panel", "gap: var(--pulso-space-2)"],
    ["states", states, ".pulso-empty-state--panel", "padding: var(--pulso-space-8) var(--pulso-space-5)"],
    ["states", states, ".pulso-empty-state-cta", "margin-top: var(--pulso-space-1)"],
    ["repeat-identity", repeatIdentity, ".pulso-repeat-badge.is-compact", "gap: var(--pulso-space-1)"],
    ["repeat-identity", repeatIdentity, ".pulso-repeat-grain", "padding: 10px var(--pulso-space-3)"],
    ["toaster", toaster, ".pulso-toaster", "gap: var(--pulso-space-2)"],
    ["toaster", toaster, ".pulso-toaster-deck", "gap: var(--pulso-space-2)"],
    ["toaster", toaster, ".pulso-toast", "padding: 11px var(--pulso-space-3)"],
    ["bases-inspector", basesInspector, ".pulso-bases-inspector-list", "gap: var(--pulso-space-2)"],
    ["bases-inspector", basesInspector, ".pulso-bases-inspector-grid dt", "gap: var(--pulso-space-1)"],
    ["bases-inspector", basesInspector, ".pulso-bases-inspector-trigger.is-selector", "gap: var(--pulso-space-2)"],
    ["bases-inspector", basesInspector, ".pulso-bases-inspector-item[data-seleccionable] .pulso-bases-inspector-item-head", "padding: 2px var(--pulso-space-1)"],
    ["dashboard", dashboardTokens, ".dashboard-scope .dash-cardbox", "padding: var(--pulso-space-3, 12px)"],
  ])("%s · %s consume la escala canónica sin cambiar su valor", (_file, source, selector, declaration) => {
    expect(
      declarationBlocksFor(source, selector).some((block) => hasExactDeclaration(block, declaration)),
    ).toBe(true);
  });

  test("no confunde propiedades que solo terminan con el mismo nombre", () => {
    expect(hasExactDeclaration("column-gap: var(--pulso-space-2);", "gap: var(--pulso-space-2)"))
      .toBe(false);
    expect(hasExactDeclaration("row-gap: var(--pulso-space-3);", "gap: var(--pulso-space-3)"))
      .toBe(false);
    expect(
      hasExactDeclaration(
        "scroll-padding-inline: var(--pulso-space-4);",
        "padding-inline: var(--pulso-space-4)",
      ),
    ).toBe(false);
  });
});
