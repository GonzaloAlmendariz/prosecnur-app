import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(__dirname, "IntegratedInstrumentsWizard.tsx"),
  "utf8",
);

function between(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("IntegratedInstrumentsWizard contracts", () => {
  it("requires exactly the planned origins before audit or import", () => {
    const factory = between("function makeManualOrigins", "function makeSurveyMonkeyOrigin");
    expect(factory).not.toContain("Math.min(2");
    expect(source).toMatch(/origins\.length\s*===\s*plannedOriginLimit/u);
  });

  it("propagates the locally selected SurveyMonkey profile to every integrated request", () => {
    expect(between("async function loadSurveys", "function toggleSurvey")).toContain("profile_id");
    expect(between("async function runAudit", "function acceptSuggestedDecisions")).toContain("profile_id");
    expect(between("async function runImport", "async function runExportDocx")).toContain("profile_id");
  });
});
