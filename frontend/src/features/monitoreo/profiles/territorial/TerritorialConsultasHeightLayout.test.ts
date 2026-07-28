import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const territorialDir = path.dirname(fileURLToPath(import.meta.url));
const styleSources = [
  fs.readFileSync(path.join(territorialDir, "..", "..", "monitoreo.css"), "utf8"),
  fs.readFileSync(path.join(territorialDir, "territorialProfile.css"), "utf8"),
];

type CssRule = {
  selector: string;
  body: string;
};

function leafRules(): CssRule[] {
  return styleSources.flatMap((source) =>
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

function isTableScoped(selector: string): boolean {
  return selector.includes(":has(.mon-territorial-review-table-shell)");
}

function targetCompound(selector: string): string {
  return selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean).at(-1) ?? "";
}

function targetsConsultasStage(selector: string): boolean {
  return targetCompound(selector).includes(".mon-stage--consultas");
}

function targetsReviewWorkbench(selector: string): boolean {
  return targetCompound(selector).includes(".mon-territorial-review-workbench");
}

function targetsTableShell(selector: string): boolean {
  return targetCompound(selector).includes(".mon-territorial-review-table-shell");
}

describe("Consultas territoriales: alto útil de la tabla", () => {
  test("el stage y el shell crecen solo cuando existe la tabla de Consultas", () => {
    const rules = leafRules();
    const stageRules = rules.filter(
      ({ selector }) => isTableScoped(selector) && targetsConsultasStage(selector),
    );
    const workbenchRules = rules.filter(
      ({ selector }) => isTableScoped(selector) && targetsReviewWorkbench(selector),
    );
    const shellRules = rules.filter(({ selector }) => isTableScoped(selector) && targetsTableShell(selector));
    const stageBody = stageRules.map(({ body }) => body).join("\n");
    const workbenchBody = workbenchRules.map(({ body }) => body).join("\n");
    const shellBody = shellRules.map(({ body }) => body).join("\n");
    const stageHeights = propertyValues(stageBody, "height");
    const workbenchHeights = propertyValues(workbenchBody, "height");
    const shellHeights = propertyValues(shellBody, "height");
    const stageFlex = propertyValues(stageBody, "flex");
    const workbenchFlex = propertyValues(workbenchBody, "flex");
    const shellFlex = propertyValues(shellBody, "flex");

    expect({
      isolatedStageRule: stageRules.length > 0,
      stageConsumesAvailableHeight:
        stageHeights.includes("100%") || stageFlex.some((value) => /^1\s+1\s+/.test(value)),
      stageKeepsAvailableMinimum: propertyValues(stageBody, "min-height").includes("100%"),
      stageAvoidsFixedOrIntrinsicHeight:
        !stageHeights.includes("320px") && !stageHeights.includes("max-content"),
      isolatedWorkbenchRule: workbenchRules.length > 0,
      workbenchConsumesAvailableHeight:
        workbenchHeights.includes("100%") || workbenchFlex.some((value) => /^1\s+1\s+/.test(value)),
      workbenchKeepsCompactMinimum: propertyValues(workbenchBody, "min-height").includes("320px"),
      workbenchAvoidsFixedOrIntrinsicHeight:
        !workbenchHeights.includes("320px") && !workbenchHeights.includes("max-content"),
      isolatedShellRule: shellRules.length > 0,
      shellConsumesAvailableHeight:
        shellHeights.includes("100%") || shellFlex.some((value) => /^1\s+1\s+/.test(value)),
      shellKeepsCompactMinimum: propertyValues(shellBody, "min-height").includes("320px"),
      shellAvoidsFixedOrIntrinsicHeight:
        !shellHeights.includes("320px") && !shellHeights.includes("max-content"),
    }).toEqual({
      isolatedStageRule: true,
      stageConsumesAvailableHeight: true,
      stageKeepsAvailableMinimum: true,
      stageAvoidsFixedOrIntrinsicHeight: true,
      isolatedWorkbenchRule: true,
      workbenchConsumesAvailableHeight: true,
      workbenchKeepsCompactMinimum: true,
      workbenchAvoidsFixedOrIntrinsicHeight: true,
      isolatedShellRule: true,
      shellConsumesAvailableHeight: true,
      shellKeepsCompactMinimum: true,
      shellAvoidsFixedOrIntrinsicHeight: true,
    });
  });

  test("mantiene el scroll interno con un viewport tabular útil", () => {
    const scrollBodies = leafRules()
      .filter(({ selector }) => selector === ".mon-territorial-review-table-scroll")
      .map(({ body }) => body)
      .join("\n");

    expect({
      scrollIsInternal: propertyValues(scrollBodies, "overflow").includes("auto"),
      scrollKeepsUsefulMinimum: propertyValues(scrollBodies, "min-height").includes("240px"),
    }).toEqual({
      scrollIsInternal: true,
      scrollKeepsUsefulMinimum: true,
    });
  });
});
