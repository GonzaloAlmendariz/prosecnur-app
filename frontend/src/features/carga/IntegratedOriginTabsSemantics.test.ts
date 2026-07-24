import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Integrated origin tabs semantics", () => {
  it("associates every dynamic origin tab with its active comparison panel", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "IntegratedInstrumentsWizard.tsx"),
      "utf8",
    );
    const block = source.slice(
      source.indexOf('{group.kind !== "single" && ('),
      source.indexOf("{groupNeedsDecision(group)", source.indexOf('{group.kind !== "single" && (')),
    );

    expect(source).toContain("map((group, groupIndex) =>");
    expect(source).toContain("integrated-origin-panel-${groupIndex}");
    expect(source).toContain("integrated-origin-tab-${groupIndex}-${activeDiffIndex}");
    expect(block).toContain("map((item, itemIndex) =>");
    expect(block).toContain('id={`integrated-origin-tab-${groupIndex}-${itemIndex}`}');
    expect(block).toContain("aria-controls={originPanelId}");
    expect(block).toContain('role={hasOriginTabs ? "tabpanel" : undefined}');
    expect(block).toContain("aria-labelledby={hasOriginTabs ? activeOriginTabId : undefined}");
    expect(block).toContain("tabIndex={hasOriginTabs ? 0 : undefined}");
  });
});
