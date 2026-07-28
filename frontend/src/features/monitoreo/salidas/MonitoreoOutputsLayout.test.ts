import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const outputsDir = path.dirname(fileURLToPath(import.meta.url));
const outputsStyles = fs.readFileSync(path.join(outputsDir, "outputsWorkbench.css"), "utf8");

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

function selectorBodies(source: string, selector: string): string {
  return Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .flatMap((match) => (match[1] ?? "").split(",").map((item) => ({ selector: item.trim(), body: match[2] ?? "" })))
    .filter((rule) => rule.selector === selector)
    .map((rule) => rule.body)
    .join("\n");
}

function propertyValues(body: string, property: string): string[] {
  const declaration = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "g");
  return Array.from(body.matchAll(declaration), (match) => (match[1] ?? "").trim());
}

describe("Salidas de Monitoreo: layout compartido", () => {
  test("el toggle de metas cabe a 1024px desde el CSS compartido de Salidas", () => {
    const responsiveBlocks = atRuleBlocks(
      outputsStyles,
      /@media\s*\([^{}]*max-width\s*:\s*(?:10(?:2[4-9]|[3-9]\d)|11\d{2})px[^{}]*\)\s*\{/g,
    );
    const toggleBody = responsiveBlocks
      .map((block) => selectorBodies(block, ".mon-outputs-targets-toggle"))
      .join("\n");
    const display = propertyValues(toggleBody, "display");

    expect({
      responsiveToggleRuleExists: toggleBody.length > 0,
      toggleCanShrink: propertyValues(toggleBody, "min-width").includes("0"),
      toggleCanWrapOrGrid:
        propertyValues(toggleBody, "flex-wrap").includes("wrap")
        || display.includes("grid")
        || propertyValues(toggleBody, "grid-template-columns").some((value) => value.includes("minmax(0, 1fr)")),
    }).toEqual({
      responsiveToggleRuleExists: true,
      toggleCanShrink: true,
      toggleCanWrapOrGrid: true,
    });
  });
});
